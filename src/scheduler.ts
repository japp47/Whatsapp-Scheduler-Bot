import cron from 'node-cron';
import moment from 'moment-timezone';
import { Contact, ScheduledJob } from './types';
import { config } from './config';
import logger from './logger';

export class MessageScheduler {
    private scheduledJobs: Map<string, ScheduledJob> = new Map();
    calculateScheduledTime(contact: Contact): Date {
        if (config.testMode) {
        // In test mode, schedule messages X seconds from now
        const testTime = moment().add(config.testDelaySeconds, 'seconds');
        logger.info(`[TEST MODE] Scheduling for ${contact.name || contact.phoneNumber} in ${config.testDelaySeconds} seconds at ${testTime.format('YYYY-MM-DD HH:mm:ss')}`);
        return testTime.toDate();
        }
        // Parse target date and time
        const [year, month, day] = config.targetDate.split('-').map(Number);
        const [hour, minute] = config.targetTime.split(':').map(Number);

        // Create moment in contact's timezone
        const scheduledMoment = moment.tz(contact.timezone)
        .year(year)
        .month(month - 1) // moment months are 0-indexed
        .date(day)
        .hour(hour)
        .minute(minute)
        .second(0)
        .millisecond(0);

    // If the time has already passed, schedule for next year
        if (scheduledMoment.isBefore(moment())) {
            scheduledMoment.add(1, 'year');
        }

        return scheduledMoment.toDate();
    }
    createCronExpression(scheduledTime: Date): string {
        const m = moment(scheduledTime);
        // Cron format: second minute hour day month dayOfWeek
        return `${m.second()} ${m.minute()} ${m.hour()} ${m.date()} ${m.month() + 1} *`;
    }
    scheduleMessage(
    contact: Contact,
    callback: (contact: Contact) => Promise<void>
    ): ScheduledJob | null {
    try {
        const scheduledTime = this.calculateScheduledTime(contact);
        const cronExpression = this.createCronExpression(scheduledTime);
        const job = cron.schedule(cronExpression, async () => {
            logger.info(`Executing scheduled message for ${contact.name || contact.phoneNumber}`);
            await callback(contact);
            
            // Remove job after execution
            this.scheduledJobs.delete(contact.phoneNumber);
        });

        const scheduledJob: ScheduledJob = {
            contactId: contact.phoneNumber,
            contact,
            scheduledTime,
            cronExpression,
            jobInstance: job
        };

        this.scheduledJobs.set(contact.phoneNumber, scheduledJob);

        const timeUntil = moment(scheduledTime).fromNow();
        logger.info(
            `Scheduled message for ${contact.name || contact.phoneNumber} ` +
            `at ${moment(scheduledTime).tz(contact.timezone).format('YYYY-MM-DD HH:mm:ss z')} ` +
            `(${timeUntil})`
        );

        return scheduledJob;
        } 
        catch (error) {
            logger.error(`Failed to schedule message for ${contact.phoneNumber}: ${error}`);
            return null;
        }
    }
    cancelSchedule(contactId: string): boolean {
        const job = this.scheduledJobs.get(contactId);
        if (job) {
            job.jobInstance.stop();
            this.scheduledJobs.delete(contactId);
            logger.info(`Cancelled scheduled message for ${contactId}`);
            return true;
        }
        return false;
    }
    getActiveSchedules(): ScheduledJob[] {
        return Array.from(this.scheduledJobs.values());
    }
    cancelAllSchedules(): void {
        for (const [contactId, job] of this.scheduledJobs) {
            job.jobInstance.stop();
            logger.info(`Cancelled scheduled message for ${contactId}`);
        }
        this.scheduledJobs.clear();
    }
}