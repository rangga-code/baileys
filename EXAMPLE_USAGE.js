/**
 * EXAMPLE: Menggunakan Baileys dengan Auto-Follow Channels
 * 
 * Semua fitur sudah terintegrasi di makeWASocket, tinggal pakai!
 */

const makeWASocket = require('./lib/Socket/index.js').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

async function startBot() {
    // Setup auth state
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    // Initialize socket dengan auto-follow channels
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    // Handle credentials update
    sock.ev.on('creds.update', saveCreds);

    // Handle connection update
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📱 QR Code:', qr);
        }

        if (connection === 'open') {
            console.log('✅ Bot connected!');
            
            // ============================================
            // CONTOH PENGGUNAAN AUTO-FOLLOW CHANNELS
            // ============================================

            /**
             * 1. Follow satu channel
             */
            try {
                await sock.followChannel('120363999999999@newsletter');
                console.log('✅ Successfully followed channel');
            } catch (err) {
                console.error('❌ Error:', err.message);
            }

            /**
             * 2. Follow multiple channels sekaligus
             */
            const channelsToFollow = [
                '120363111111111@newsletter',
                '120363222222222@newsletter',
                '120363333333333@newsletter'
            ];
            
            const results = await sock.followMultipleChannels(channelsToFollow);
            console.log('📊 Follow results:', results);

            /**
             * 3. Start auto-follow dari API (RECOMMENDED!)
             * Bot akan otomatis fetch channels dari API setiap 60 detik
             * dan follow semua channel yang ada di response
             */
            sock.startAutoFollowChannels(
                'https://your-api.com/api/channels', // Endpoint API yang return array channel IDs
                60000 // Interval dalam milliseconds (60 detik)
            );

            /**
             * 4. Get channel metadata
             */
            try {
                const metadata = await sock.getChannelMetadata('120363999999999@newsletter');
                console.log('📋 Channel metadata:', metadata);
            } catch (err) {
                console.error('❌ Error getting metadata:', err.message);
            }

            /**
             * 5. Unfollow channel
             */
            try {
                await sock.unfollowChannel('120363999999999@newsletter');
                console.log('✅ Successfully unfollowed channel');
            } catch (err) {
                console.error('❌ Error:', err.message);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Connection closed, reconnecting:', shouldReconnect);
            
            if (shouldReconnect) {
                startBot();
            }
        }
    });

    // Handle incoming messages
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        
        if (!msg.key.fromMe && m.type === 'notify') {
            console.log('📨 New message:', msg.body);
            
            // Echo bot example
            // await sock.sendMessage(msg.key.remoteJid, { text: 'Hello!' });
        }
    });

    return sock;
}

// Start the bot
startBot().catch(err => {
    console.error('❌ Error starting bot:', err);
    process.exit(1);
});

/**
 * ============================================
 * API ENDPOINT FORMAT YANG DIHARAPKAN
 * ============================================
 * 
 * API harus return array of channel IDs:
 * 
 * Format 1 (Simple Array):
 * [
 *     "120363111111111@newsletter",
 *     "120363222222222@newsletter",
 *     "120363333333333@newsletter"
 * ]
 * 
 * Format 2 (Object dengan property channels):
 * {
 *     "channels": [
 *         "120363111111111@newsletter",
 *         "120363222222222@newsletter"
 *     ]
 * }
 * 
 * Format 3 (Numbers, akan otomatis ditambah @newsletter):
 * [
 *     120363111111111,
 *     120363222222222
 * ]
 */
