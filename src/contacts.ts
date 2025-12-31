import * as fs from 'fs';
import * as path from 'path';
import moment from 'moment-timezone';
import { Contact, ContactsData } from './types';
import logger from './logger';

export class ContactManager {
    private contacts: Contact[] = [];

    loadContacts(filePath: string): Contact[] {
        try {
            const absolutePath = path.resolve(filePath);
            if (!fs.existsSync(absolutePath)) {
                throw new Error(`Contact file not found: ${absolutePath}`);
            }

            const fileContent = fs.readFileSync(absolutePath, 'utf-8');
            const data: ContactsData = JSON.parse(fileContent);

            if (!data.contacts || !Array.isArray(data.contacts)) {
                throw new Error('Invalid contacts.json format. Expected { "contacts": [...] }');
            }

            this.contacts = data.contacts;
            logger.info(`Loaded ${this.contacts.length} contacts from ${filePath}`);
            
            return this.contacts;
        } 
        catch (error) {
            logger.error(`Failed to load contacts: ${error}`);
            throw error;
        }
    }
    validateContacts(): { valid: Contact[], invalid: Array<{ contact: Contact, reason: string }> } {
        const valid: Contact[] = [];
        const invalid: Array<{ contact: Contact, reason: string }> = [];
        for (const contact of this.contacts) {
            const validation = this.validateContact(contact);
            if (validation.isValid) {
                valid.push(contact);
            } else {
            invalid.push({ contact, reason: validation.reason || 'Unknown error' });
            }
        }

        return { valid, invalid };
    }
    private validateContact(contact: Contact): { isValid: boolean, reason?: string } {  
        // Validate phone number
        if (!contact.phoneNumber) {
            return { isValid: false, reason: 'Phone number is required' };
        }
        const phoneRegex = /^[1-9]\d{9,14}$/;
        if (!phoneRegex.test(contact.phoneNumber)) {
            return { isValid: false, reason: 'Invalid phone number format (must be country code + number, 10-15 digits)' };
        }
        // Validate timezone
        if (!contact.timezone) {
        return { isValid: false, reason: 'Timezone is required' };
        }
        if (!moment.tz.zone(contact.timezone)) {
            return { isValid: false, reason: `Invalid timezone: ${contact.timezone}` };
        }
        return { isValid: true };
    }
    formatPhoneNumber(phoneNumber: string): string {
        // WhatsApp format: countrycode + number without + or spaces
        return phoneNumber.replace(/[^0-9]/g, '') + '@c.us';
    }
    getContacts(): Contact[] {
        return this.contacts;
    }
}