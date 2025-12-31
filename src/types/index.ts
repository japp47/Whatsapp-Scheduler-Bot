export interface Contact {
phoneNumber: string;
timezone: string;
name?: string;
}
export interface ContactsData {
contacts: Contact[];
}
export interface Config {
message: string;
targetDate: string;
targetTime: string;
sessionPath: string;
logLevel: string;
logFile: string;
testMode: boolean;
testDelaySeconds: number;
}
export interface ScheduledJob {
contactId: string;
contact: Contact;
scheduledTime: Date;
cronExpression: string;
jobInstance: any;
}