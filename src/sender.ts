import { Client } from 'whatsapp-web.js';
import { Contact } from './types';
import { config } from './config';
import logger from './logger';

export class MessageSender {
    private client: Client;
    private maxRetries: number = 3;
    private retryDelay: number = 60000; // 1 minute
    constructor(client: Client) {
        this.client = client;
    }
    async sendMessage(contact: Contact): Promise<boolean> {
        const formattedNumber = this.formatPhoneNumber(contact.phoneNumber);
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                logger.info(
                `Sending message to ${contact.name || contact.phoneNumber} ` +
                `(Attempt ${attempt}/${this.maxRetries})`
                );

                await this.client.sendMessage(formattedNumber, config.message);
    
                logger.info(`✅ Successfully sent message to ${contact.name || contact.phoneNumber}`);
                return true;
            } catch (error) {
                logger.error(
                `❌ Failed to send message to ${contact.name || contact.phoneNumber} ` +
                `(Attempt ${attempt}/${this.maxRetries}): ${error}`
                );

                if (attempt < this.maxRetries) {
                const delay = this.retryDelay * attempt; // Exponential backoff
                logger.info(`Retrying in ${delay / 1000} seconds...`);
                await this.sleep(delay);
                }
            }
        }

        logger.error(
        `❌ Failed to send message to ${contact.name || contact.phoneNumber} ` +
        `after ${this.maxRetries} attempts`
        );
        return false;
    }
    private formatPhoneNumber(phoneNumber: string): string {
        // WhatsApp format: countrycode + number + @c.us
        return phoneNumber.replace(/[^0-9]/g, '') + '@c.us';
    }
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}