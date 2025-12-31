import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { config } from './config';
import logger from './logger';

export class WhatsAppAuth {
    private client: Client;
    private isReady: boolean = false;
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: config.sessionPath
            }),
            puppeteer: {
                headless: true,
                args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
                ]
            }
        });
        this.setupEventHandlers();
    }
    private setupEventHandlers(): void {
        this.client.on('qr', (qr) => {
            logger.info('QR Code received. Please scan with your WhatsApp:');
            qrcode.generate(qr, { small: true });
            console.log('\n');
        });
        this.client.on('ready', () => {
        this.isReady = true;
        logger.info('WhatsApp client is ready!');
        });

        this.client.on('authenticated', () => {
        logger.info('Authentication successful!');
        });

        this.client.on('auth_failure', (msg) => {
        logger.error(`Authentication failed: ${msg}`);
        });

        this.client.on('disconnected', (reason) => {
        logger.warn(`WhatsApp client disconnected: ${reason}`);
        this.isReady = false;
        });
    }
    async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            logger.info('Initializing WhatsApp client...');
            const timeout = setTimeout(() => {
                reject(new Error('WhatsApp initialization timeout (60 seconds)'));
            }, 60000);

            this.client.once('ready', () => {
                clearTimeout(timeout);
                resolve();
            });

            this.client.once('auth_failure', () => {
                clearTimeout(timeout);
                reject(new Error('WhatsApp authentication failed'));
            });

            this.client.initialize().catch(reject);
        });
    }
    getClient(): Client {
        return this.client;
    }
    isClientReady(): boolean {
        return this.isReady;
    }
    async destroy(): Promise<void> {    
        await this.client.destroy();
        logger.info('WhatsApp client destroyed');
    }
}