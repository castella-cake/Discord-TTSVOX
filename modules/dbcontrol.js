const { initial_userdata, initial_serverdata, database_host } = require('../config.json');
const Keyv = require('keyv');
const userdata = new Keyv(database_host, { table: 'userobj' })
const serverdata = new Keyv(database_host, { table: 'serverobj' })

function getUserData(memberId) {
    return new Promise((resolve, reject) => {
        userdata.get(memberId).then(async data => {
            if( data === undefined || data === null ) {
                resolve(initial_userdata)
            } else {
                resolve(data)
            }
        })
    })
}

function setUserData(memberId, data) {
    userdata.set(memberId, data)
}

function getServerData(guildId) {
    return new Promise((resolve, reject) => {
        serverdata.get(guildId).then(data => {
            if( data === undefined ) {
                resolve(initial_serverdata)
            } else {
                resolve(data)
            }
        })
    })
}

function setServerData(guildId, data) {
    serverdata.set(guildId, data)
}

function getDataBase(type, id) {
    return new Promise((resolve, reject) => {
        if ( type == "server" ) {
            serverdata.get(id).then(data => {
                if( data === undefined ) {
                    resolve(initial_serverdata)
                } else {
                    resolve(data)
                }
            })
        } else {
            userdata.get(id).then(async data => {
                if( data === undefined || data === null ) {
                    resolve(initial_userdata)
                } else {
                    resolve(data)
                }
            })
        }
    })
}

function setDataBase(type, id, data) {
    if ( type == "server" ) {
        serverdata.set(id, data)
    } else {
        userdata.set(id, data)
    }
    
}

module.exports = { getUserData, setUserData, getServerData, setServerData, getDataBase, setDataBase }