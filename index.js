const steamUser = require('steam-user');
const steamTotp = require('steam-totp');
const keep_alive = require('./keep_alive.js');

var username = process.env.login;
var password = process.env.password;
var shared_secret = process.env.shared;

var games = [251570, 382080, 628750, 461730, 533180, 1578650, 529420, 349500, 334040, 412880, 564210, 308000, 545470, 320400, 739630, 623580, 431810, 433210, 567780, 730];  // App ID need games
var status = 7;  // 1 - online, 7 - invisible


var user = new steamUser();
user.logOn({"accountName": username, "password": password, "twoFactorCode": steamTotp.generateAuthCode(shared_secret)});
user.on('loggedOn', () => {
    if (user.steamID != null) console.log(user.steamID + ' - Bot login in account and hour boosting is starting right now');
    user.setPersona(status);
    user.gamesPlayed(games);
});
