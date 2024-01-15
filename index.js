const steamUser = require('steam-user');
const steamTotp = require('steam-totp');
const keep_alive = require('./keep_alive.js');

var username = process.env.login;
var password = process.env.password;
var shared_secret = process.env.shared;

var games = [730, 570];  // App ID need games
var status = 7;  // 1 - online, 7 - invisible


var user = new steamUser();
user.logOn({"accountName": username, "password": password, "twoFactorCode": steamTotp.generateAuthCode(shared_secret)});
user.on('loggedOn', () => {
    if (user.steamID != null) console.log(user.steamID + ' - Bot login in account and hour boosting is starting right now');
    user.setPersona(status);
    user.gamesPlayed(games);
});
