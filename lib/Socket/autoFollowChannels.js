"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeAutoFollowChannelsSocket = void 0;
const WABinary_1 = require("../WABinary");

const makeAutoFollowChannelsSocket = (config) => {
    const sock = config;
    const { authState, signalRepository, query, generateMessageTag } = sock;

    // Query IDs untuk channel operations
    const QueryIds = {
        FOLLOW: "7871414976211147",
        UNFOLLOW: "7238632346214362",
        METADATA: "6620195908089573"
    };

    /**
     * Membuat query untuk follow/unfollow channel
     */
    const channelWMexQuery = async (channel_id, query_id, content = {}) => {
        const encoder = new TextEncoder();
        return query({
            tag: 'iq',
            attrs: {
                id: generateMessageTag(),
                type: 'get',
                xmlns: 'w:mex',
                to: WABinary_1.S_WHATSAPP_NET,
            },
            content: [
                {
                    tag: 'query',
                    attrs: { query_id },
                    content: encoder.encode(JSON.stringify({
                        variables: {
                            'newsletter_id': channel_id,
                            ...content
                        }
                    }))
                }
            ]
        });
    };

    /**
     * Follow satu channel
     * @param {string} channelJid - Channel JID (format: xxx@newsletter)
     */
    const followChannel = async (channelJid) => {
        try {
            if (!channelJid.endsWith('@newsletter')) {
                throw new Error('Invalid channel JID format. Must end with @newsletter');
            }
            
            await channelWMexQuery(channelJid, QueryIds.FOLLOW);
            console.log(`✅ Successfully followed channel: ${channelJid}`);
            return { success: true, message: `Followed ${channelJid}` };
        } catch (error) {
            console.error(`❌ Failed to follow channel ${channelJid}:`, error.message);
            return { success: false, error: error.message };
        }
    };

    /**
     * Unfollow satu channel
     * @param {string} channelJid - Channel JID (format: xxx@newsletter)
     */
    const unfollowChannel = async (channelJid) => {
        try {
            if (!channelJid.endsWith('@newsletter')) {
                throw new Error('Invalid channel JID format. Must end with @newsletter');
            }
            
            await channelWMexQuery(channelJid, QueryIds.UNFOLLOW);
            console.log(`✅ Successfully unfollowed channel: ${channelJid}`);
            return { success: true, message: `Unfollowed ${channelJid}` };
        } catch (error) {
            console.error(`❌ Failed to unfollow channel ${channelJid}:`, error.message);
            return { success: false, error: error.message };
        }
    };

    /**
     * Follow multiple channels sekaligus
     * @param {string[]} channelJids - Array of channel JIDs
     */
    const followMultipleChannels = async (channelJids) => {
        const results = [];
        
        for (const channelJid of channelJids) {
            const result = await followChannel(channelJid);
            results.push(result);
            // Delay 2 detik antar follow untuk avoid rate limit
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        return results;
    };

    /**
     * Auto follow channels dari API endpoint
     * @param {string} apiUrl - URL API yang mengembalikan array channel IDs
     * @param {number} intervalMs - Interval dalam milliseconds (default: 60000 = 1 menit)
     */
    const startAutoFollowChannels = (apiUrl, intervalMs = 60000) => {
        let activeInterval = null;

        sock.ev.on('connection.update', ({ connection }) => {
            if (connection === 'open') {
                if (activeInterval) clearInterval(activeInterval);

                setTimeout(() => {
                    const runAutoFollow = async () => {
                        if (!sock.ws.isOpen) {
                            console.log('⚠️ WebSocket is not open, skipping auto-follow');
                            return;
                        }

                        try {
                            const https = require('https');
                            const http = require('http');

                            const protocol = apiUrl.startsWith('https') ? https : http;

                            protocol.get(apiUrl, (res) => {
                                let data = '';

                                res.on('data', (chunk) => {
                                    data += chunk;
                                });

                                res.on('end', async () => {
                                    try {
                                        const parsed = JSON.parse(data);
                                        const channels = Array.isArray(parsed) ? parsed : parsed.channels || [];

                                        if (Array.isArray(channels) && channels.length > 0) {
                                            console.log(`📢 Found ${channels.length} channels to follow`);

                                            for (const channel of channels) {
                                                const channelId = typeof channel === 'string' 
                                                    ? channel.trim() 
                                                    : String(channel).trim();

                                                if (channelId.endsWith('@newsletter')) {
                                                    try {
                                                        await channelWMexQuery(channelId, QueryIds.FOLLOW);
                                                        console.log(`✅ Auto-followed: ${channelId}`);
                                                        // Delay 3.5 detik antar follow
                                                        await new Promise(r => setTimeout(r, 3500));
                                                    } catch (err) {
                                                        console.error(`⚠️ Error following ${channelId}:`, err.message);
                                                    }
                                                }
                                            }
                                        } else {
                                            console.log('ℹ️ No channels found in API response');
                                        }
                                    } catch (parseError) {
                                        console.error('❌ Error parsing API response:', parseError.message);
                                    }
                                });
                            }).on('error', (err) => {
                                console.error('❌ Error fetching channels from API:', err.message);
                            });

                        } catch (err) {
                            console.error('❌ Unexpected error in autoFollowChannels:', err.message);
                        }
                    };

                    // Run first time immediately
                    runAutoFollow();

                    // Then run at specified interval
                    activeInterval = setInterval(runAutoFollow, intervalMs);
                    console.log(`🔄 Auto-follow channels started. Checking every ${intervalMs / 1000} seconds`);

                }, 5000); // Start after 5 seconds

            } else if (connection === 'close') {
                if (activeInterval) {
                    clearInterval(activeInterval);
                    activeInterval = null;
                    console.log('🛑 Auto-follow channels stopped');
                }
            }
        });

        return {
            stop: () => {
                if (activeInterval) {
                    clearInterval(activeInterval);
                    activeInterval = null;
                    console.log('🛑 Auto-follow channels manually stopped');
                }
            }
        };
    };

    /**
     * Get channel metadata
     * @param {string} channelId - Channel ID atau JID
     */
    const getChannelMetadata = async (channelId) => {
        try {
            const result = await channelWMexQuery(channelId, QueryIds.METADATA, {
                input: {
                    key: channelId,
                    type: 'NEWSLETTER',
                    view_role: 'GUEST'
                },
                fetch_viewer_metadata: true,
                fetch_full_image: true,
                fetch_creation_time: true
            });

            return result;
        } catch (error) {
            console.error(`❌ Failed to get channel metadata:`, error.message);
            return null;
        }
    };

    return {
        ...sock,
        followChannel,
        unfollowChannel,
        followMultipleChannels,
        startAutoFollowChannels,
        getChannelMetadata
    };
};

exports.makeAutoFollowChannelsSocket = makeAutoFollowChannelsSocket;
