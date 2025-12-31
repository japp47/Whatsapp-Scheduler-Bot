import inquirer from 'inquirer';
import moment from 'moment-timezone';
import { Contact } from './types';
import { getDatabase, closeDatabase } from './database';

const availableTimezones = moment.tz.names();

export async function showMainMenu(): Promise<string> {
    const db = getDatabase();
    const contactCount = db.getContactCount();

    const savedMessage = db.getLatestCustomMessage();
    let messageInfo = '';
    if (savedMessage) {
        messageInfo = `\n📝 Current message: "${savedMessage.message.substring(0, 50)}..."`;
    }

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║        🎉 WhatsApp New Year Message Bot 🎉              ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  📇 Saved Contacts: ${contactCount.toString().padEnd(32)}║`);
    console.log(`╚══════════════════════════════════════════════════════════╝${messageInfo}`);
    console.log('');

    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'Choose an action:',
            choices: [
                { name: '🚀 Send New Year Wishes', value: 'send' },
                { name: '👥 View Saved Contacts', value: 'view' },
                { name: '➕ Add New Contact', value: 'add' },
                { name: '✏️  Edit Contact', value: 'edit' },
                { name: '🗑️  Delete Contact', value: 'delete' },
                { name: '💬 Customize Message', value: 'message' },
                { name: '📋 Import from JSON', value: 'import' },
                { name: '🚪 Exit', value: 'exit' }
            ]
        }
    ]);

    switch (action) {
        case 'send':
            await showSendMenu();
            break;
        case 'view':
            await showContactsList();
            break;
        case 'add':
            await addContactPrompt();
            break;
        case 'edit':
            await editContactPrompt();
            break;
        case 'delete':
            await deleteContactPrompt();
            break;
        case 'message':
            await customizeMessagePrompt();
            break;
        case 'import':
            await importFromJSONPrompt();
            break;
        case 'exit':
            return 'exit';
    }

    return 'continue';
}

async function showSendMenu(): Promise<void> {
    const db = getDatabase();
    const contacts = db.getAllContacts();

    if (contacts.length === 0) {
        console.log('📭 No contacts saved. Please add contacts first.');
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        return;
    }

    const { targetType } = await inquirer.prompt([
        {
            type: 'list',
            name: 'targetType',
            message: 'Send to:',
            choices: [
                { name: 'All Contacts', value: 'all' },
                { name: 'Select Specific Contacts', value: 'select' }
            ]
        }
    ]);

    let selectedContacts: Contact[] = [];

    if (targetType === 'all') {
        selectedContacts = contacts;
    } else {
        const contactChoices = contacts.map(c => ({
            name: `${c.name || 'Unknown'} (${c.phoneNumber})`,
            value: c.phoneNumber
        }));

        const { selected } = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'selected',
                message: 'Select contacts to send to:',
                choices: contactChoices
            }
        ]);

        if (!selected || selected.length === 0) {
            console.log('❌ No contacts selected.');
            await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
            return;
        }

        selectedContacts = contacts.filter(c => selected.includes(c.phoneNumber));
    }

    console.log('\n📤 Send Summary:');
    console.log(`   Target: ${selectedContacts.length} contact(s)`);
    selectedContacts.forEach(c => {
        console.log(`   • ${c.name || 'Unknown'}: ${c.phoneNumber} (${c.timezone})`);
    });

    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: 'Ready to send? (This will start WhatsApp bot)',
            default: false
        }
    ]);

    if (confirm) {
        (global as any).selectedContacts = selectedContacts;
        return;
    }
}

async function showContactsList(): Promise<void> {
    const db = getDatabase();
    const contacts = db.getAllContacts();

    console.log('\n📇 SAVED CONTACTS');
    console.log('═'.repeat(60));

    if (contacts.length === 0) {
        console.log('   No contacts saved yet.');
    } else {
        contacts.forEach((c, index) => {
            console.log(`   ${index + 1}. ${c.name || 'Unknown'}`);
            console.log(`      📱 ${c.phoneNumber}`);
            console.log(`      🌍 ${c.timezone}`);
            console.log('');
        });
    }

    console.log('═'.repeat(60));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
}

async function addContactPrompt(): Promise<void> {
    console.log('\n➕ ADD NEW CONTACT');

    const questions = [
        {
            type: 'input',
            name: 'phoneNumber',
            message: 'Phone number (with country code, e.g., 919352373221):',
            validate: (input: string) => {
                const cleaned = input.replace(/[^0-9]/g, '');
                return cleaned.length >= 10 && cleaned.length <= 15 || 'Please enter a valid phone number (10-15 digits)';
            }
        },
        {
            type: 'input',
            name: 'name',
            message: 'Name (optional):'
        },
        {
            type: 'list',
            name: 'timezone',
            message: 'Select timezone:',
            choices: [
                { name: '🇮🇳 Asia/Kolkata', value: 'Asia/Kolkata' },
                { name: '🇺🇸 America/New_York', value: 'America/New_York' },
                { name: '🇺🇸 America/Los_Angeles', value: 'America/Los_Angeles' },
                { name: '🇬🇧 Europe/London', value: 'Europe/London' },
                { name: '🇪🇺 Europe/Paris', value: 'Europe/Paris' },
                { name: '🇦🇺 Australia/Sydney', value: 'Australia/Sydney' },
                { name: '🔍 Search timezone...', value: 'search' }
            ]
        }
    ];

    let answers = await inquirer.prompt(questions);

    if (answers.timezone === 'search') {
        const { searchQuery } = await inquirer.prompt([
            {
                type: 'input',
                name: 'searchQuery',
                message: 'Search timezone (e.g., India, New York, London):'
            }
        ]);

        const filtered = availableTimezones.filter(tz =>
            tz.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 10);

        if (filtered.length === 0) {
            console.log('❌ No timezones found. Using UTC.');
            answers.timezone = 'UTC';
        } else {
            const { selectedTz } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'selectedTz',
                    message: 'Select timezone:',
                    choices: filtered.map(tz => ({ name: tz, value: tz }))
                }
            ]);
            answers.timezone = selectedTz;
        }
    }

    const db = getDatabase();
    const phone = answers.phoneNumber.replace(/[^0-9]/g, '');

    if (db.contactExists(phone)) {
        console.log(`❌ Contact with phone ${phone} already exists!`);
    } else {
        const contact: Contact = {
            phoneNumber: phone,
            timezone: answers.timezone,
            name: answers.name || undefined
        };

        if (db.addContact(contact)) {
            console.log(`✅ Contact added successfully!`);
        } else {
            console.log(`❌ Failed to add contact.`);
        }
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
}

async function editContactPrompt(): Promise<void> {
    const db = getDatabase();
    const contacts = db.getAllContacts();

    if (contacts.length === 0) {
        console.log('📭 No contacts to edit.');
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        return;
    }

    const { selectedPhone } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selectedPhone',
            message: 'Select contact to edit:',
            choices: contacts.map(c => ({
                name: `${c.name || 'Unknown'} (${c.phoneNumber})`,
                value: c.phoneNumber
            }))
        }
    ]);

    const contact = db.getContactByPhone(selectedPhone);
    if (!contact) {
        console.log('❌ Contact not found.');
        return;
    }

    const { newName, newTimezone } = await inquirer.prompt([
        {
            type: 'input',
            name: 'newName',
            message: `Name (current: ${contact.name || 'N/A'}):`,
            default: contact.name || ''
        },
        {
            type: 'list',
            name: 'newTimezone',
            message: `Timezone (current: ${contact.timezone}):`,
            choices: [
                { name: `Keep as ${contact.timezone}`, value: null },
                ...availableTimezones.slice(0, 30).map(tz => ({ name: tz, value: tz }))
            ]
        }
    ]);

    const updates: Partial<Contact> = { name: newName };
    if (newTimezone) {
        updates.timezone = newTimezone;
    }

    if (db.updateContact(selectedPhone, updates)) {
        console.log('✅ Contact updated successfully!');
    } else {
        console.log('❌ Failed to update contact.');
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
}

async function deleteContactPrompt(): Promise<void> {
    const db = getDatabase();
    const contacts = db.getAllContacts();

    if (contacts.length === 0) {
        console.log('📭 No contacts to delete.');
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        return;
    }

    const { selectedPhone } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selectedPhone',
            message: 'Select contact to delete:',
            choices: contacts.map(c => ({
                name: `${c.name || 'Unknown'} (${c.phoneNumber})`,
                value: c.phoneNumber
            }))
        }
    ]);

    const contact = db.getContactByPhone(selectedPhone);
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: `Delete ${contact?.name || 'this contact'} (${selectedPhone})? This cannot be undone.`,
            default: false
        }
    ]);

    if (confirm) {
        if (db.deleteContact(selectedPhone)) {
            console.log('✅ Contact deleted successfully!');
        } else {
            console.log('❌ Failed to delete contact.');
        }
    } else {
        console.log('❌ Delete cancelled.');
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
}

async function customizeMessagePrompt(): Promise<void> {
    const db = getDatabase();
    const saved = db.getLatestCustomMessage();

    console.log('\n💬 CUSTOMIZE MESSAGE');
    console.log('═'.repeat(60));

    if (saved) {
        console.log(`Current: "${saved.message}" (${saved.target_date})`);
    }

    const { message, targetDate } = await inquirer.prompt([
        {
            type: 'input',
            name: 'message',
            message: 'Enter New Year message:',
            default: saved?.message || 'Happy New Year 2026! 🎉'
        },
        {
            type: 'input',
            name: 'targetDate',
            message: 'Target date (YYYY-MM-DD):',
            default: saved?.target_date || '2026-01-01',
            validate: (input: string) => {
                return /^\d{4}-\d{2}-\d{2}$/.test(input) || 'Please enter YYYY-MM-DD';
            }
        }
    ]);

    db.saveCustomMessage(message, targetDate);
    console.log('✅ Message saved!');
    console.log('═'.repeat(60));

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
}

async function importFromJSONPrompt(): Promise<void> {
    const db = getDatabase();

    const { filePath } = await inquirer.prompt([
        {
            type: 'input',
            name: 'filePath',
            message: 'Path to JSON file:',
            default: 'data/contacts.json'
        }
    ]);

    try {
        const fs = require('fs');
        const path = require('path');
        const absolutePath = path.resolve(filePath);

        if (!fs.existsSync(absolutePath)) {
            console.log(`❌ File not found: ${absolutePath}`);
        } else {
            const content = fs.readFileSync(absolutePath, 'utf-8');
            const data = JSON.parse(content);

            if (!data.contacts || !Array.isArray(data.contacts)) {
                console.log('❌ Invalid JSON format. Expected { "contacts": [...] }');
            } else {
                const imported = db.importFromJSON(data);
                console.log(`✅ Successfully imported ${imported} contacts!`);
            }
        }
    } catch (error) {
        console.log(`❌ Error importing: ${error}`);
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
}
