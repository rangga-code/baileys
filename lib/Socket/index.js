"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { makeAutoFollowChannelsSocket } = require("./autoFollowChannels")
const { makeCommunitiesSocket } = require("./community")

// export the last socket layer
const makeWASocket = (config) => {
	const newConfig = {
    	...require("../Defaults/connection").DEFAULT_CONNECTION_CONFIG,
   	 ...config
     }
     
    if (config.shouldSyncHistoryMessage === undefined) {
         newConfig.shouldSyncHistoryMessage = () => !!newConfig.syncFullHistory
     }

    // Chain all socket modules
    const communitiesSocket = makeCommunitiesSocket(newConfig)
    const autoFollowSocket = makeAutoFollowChannelsSocket(communitiesSocket)
    
    return autoFollowSocket
}

exports.default = makeWASocket
