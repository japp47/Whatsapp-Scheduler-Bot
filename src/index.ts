import { WhatsAppAuth } from './auth';
import { ContactManager } from './contacts';
import { MessageScheduler } from './scheduler';
import { MessageSender } from './sender';
import { config } from './config';
import logger from './logger';
import * as path from 'path';
import { getDatabase, closeDatabase } from './database';
import { showMainMenu } from './menu';
import * as fs from 'fs';
import { ContactsData, Contact } from './types';

class WhatsAppBot {
    private auth: WhatsAppAuth;
    private isShuttingDown = false;
    private contactManager: ContactManager;
    private scheduler: MessageScheduler;
    private sender: MessageSender | null = null;

    constructor() {
        this.auth = new WhatsAppAuth();
        this.contactManager = new ContactManager();
        this.scheduler = new MessageScheduler();
    }

    private async runInteractiveMode(): Promise<void> {
        console.log('🎉 Welcome to WhatsApp New Year Bot - Interactive Mode\n');

        while (true) {
            // Show interactive menu
            await showMainMenu();

            // After menu, check if user wants to send
            if ((global as any).selectedContacts) {
                console.log('\n🚀 Starting bot with selected contacts...');
                //await this.run();
                break; // Exit after running
            }
            
            // Loop back to menu (user did Exit or other action without sending)
            console.log('\nReturning to main menu...');
        }
    }

    async run(): Promise<void> {
        // Check for interactive mode flag
        if (process.argv.includes('--interactive') || process.argv.includes('-i')) {
            await this.runInteractiveMode();
            //return;
        }

        try {
            logger.info('🚀 WhatsApp New Year Message Bot Starting...');
            if (config.testMode) {
                logger.info('⚠️  TEST MODE ENABLED - Messages will be sent in ' + config.testDelaySeconds + ' seconds');
            }

            // Step 1: Load and validate contacts (with database fallback)
            logger.info('📋 Loading contacts...');
            const db = getDatabase();

            // Check if database has contacts, if not try to migrate from JSON
            if (!db.hasContacts()) {
                logger.info('📦 No contacts in database. Checking for existing contacts.json...');
                const contactsPath = path.resolve('./data/contacts.json');
                if (fs.existsSync(contactsPath)) {
                    try {
                        const fileContent = fs.readFileSync(contactsPath, 'utf-8');
                        const data: ContactsData = JSON.parse(fileContent);
                        if (data.contacts && Array.isArray(data.contacts)) {
                            const imported = db.importFromJSON(data);
                            logger.info(`📦 Migrated ${imported} contacts from contacts.json to database`);
                        }
                    } catch (e) {
                        logger.warn('⚠️  Failed to load contacts.json, will use empty contacts');
                    }
                }
            }

            // Get contacts from database (with JSON fallback if DB is empty)
            let contacts = db.getAllContacts();
            
            // If still no contacts, try loading from JSON directly
            if (contacts.length === 0) {
                const contactsPath = path.resolve('./data/contacts.json');
                if (fs.existsSync(contactsPath)) {
                    this.contactManager.loadContacts(contactsPath);
                    const result = this.contactManager.validateContacts();
                    contacts = result.valid;
                    
                    if (result.invalid.length > 0) {
                        logger.warn(`⚠️  Found ${result.invalid.length} invalid contacts:`);
                        result.invalid.forEach(({ contact, reason }) => {
                            logger.warn(`  - ${contact.phoneNumber}: ${reason}`);
                        });
                    }
                }
            }

            if (contacts.length === 0) {
                logger.info('📭 No contacts found! Starting interactive mode to add contacts...');
                await showMainMenu();
                // After menu, check again and restart if needed
                contacts = db.getAllContacts();
                if (contacts.length === 0) {
                    throw new Error('No valid contacts found. Please add contacts first.');
                }
            }

            logger.info(`✅ Loaded ${contacts.length} contacts`);

            // Check if we have selected contacts from interactive mode
            let contactsToSend: Contact[] = contacts;
            if ((global as any).selectedContacts) {
                contactsToSend = (global as any).selectedContacts;
                logger.info(`📤 Using ${contactsToSend.length} contacts selected from interactive mode`);
            }

            // Step 2: Initialize WhatsApp
            logger.info('📱 Initializing WhatsApp client...');
            await this.auth.initialize();

            // Step 3: Create message sender
            this.sender = new MessageSender(this.auth.getClient());

            // Step 4: Schedule messages for all valid contacts
            logger.info('⏰ Scheduling messages...');
            let scheduledCount = 0;

            for (const contact of contactsToSend) {
                const job = this.scheduler.scheduleMessage(contact, async (c) => {
                    if (this.sender) {
                        await this.sender.sendMessage(c);
                    }
                });

                if (job) {
                    scheduledCount++;
                }
            }

            logger.info(`✅ Successfully scheduled ${scheduledCount} messages`);
            logger.info('🤖 Bot is now running. Press Ctrl+C to stop.');

            // Display schedule summary
            this.displayScheduleSummary();

            // Keep the process running
            this.keepAlive();
        } catch (error) {
            logger.error(`❌ Fatal error: ${error}`);
            await this.cleanup();
            process.exit(1);
        }
    }

    private displayScheduleSummary(): void {
        const schedules = this.scheduler.getActiveSchedules();
        console.log('\n' + '='.repeat(80));
        console.log('📅 SCHEDULED MESSAGES SUMMARY');
        console.log('='.repeat(80));

        schedules.forEach((schedule, index) => {
            const time = new Date(schedule.scheduledTime).toLocaleString('en-US', {
                timeZone: schedule.contact.timezone,
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZoneName: 'short'
            });

            console.log(`${index + 1}. ${schedule.contact.name || 'Unknown'}`);
            console.log(`   Phone: ${schedule.contact.phoneNumber}`);
            console.log(`   Timezone: ${schedule.contact.timezone}`);
            console.log(`   Scheduled: ${time}`);
            console.log('');
        });

        console.log('='.repeat(80) + '\n');
    }

    private keepAlive(): void {
    const shutdown = async (signal: string) => {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        logger.info(`\n🛑 Received ${signal}. Shutting down gracefully...`);

        try {
            this.scheduler.cancelAllSchedules();
            await this.auth.destroy();
            closeDatabase();
            logger.info('👋 Shutdown complete');
        } catch (err) {
            logger.error('❌ Error during shutdown:', err);
        } finally {
            process.exit(0);
        }
    };

    process.on('SIGINT', shutdown);   // Ctrl + C
    process.on('SIGTERM', shutdown);  // Kill / Docker / PM2
    process.on('uncaughtException', async (err) => {
        logger.error('❌ Uncaught Exception:', err);
        await shutdown('uncaughtException');
    });
}


    private async cleanup(): Promise<void> {
        logger.info('🧹 Cleaning up...');
        this.scheduler.cancelAllSchedules();
        await this.auth.destroy();
        closeDatabase();
        logger.info('👋 Goodbye!');
    }
}

// Entry point
const bot = new WhatsAppBot();
bot.run().catch((error) => {
    logger.error(`Unhandled error: ${error}`);
    process.exit(1);
});

