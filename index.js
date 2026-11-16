const steamUser = require('steam-user');
const steamTotp = require('steam-totp');
require('./keep_alive.js'); // keep-alive сервер для Render

const username = process.env.login;
const password = process.env.password;
const shared_secret = process.env.shared;

const games = [730]; // App ID игры
const status = 7; // 1 - online, 7 - invisible

const user = new steamUser();

// Флаг: играет ли пользователь сейчас на другом устройстве
let playingOnOtherSession = false;

// Функция, которая включает или выключает накрутку в зависимости от флага
function refreshGames() {
    if (playingOnOtherSession) {
        // Пользователь играет сам — бот ничего не делает, но остаётся в сети
        console.log('Пользователь играет на другом устройстве. Накрутка приостановлена.');
        return;
    }
    // Пользователь не играет — запускаем игры
    user.gamesPlayed(games);
    console.log('Накрутка активна: ' + games.join(', '));
}

user.logOn({
    accountName: username,
    password: password,
    twoFactorCode: steamTotp.generateAuthCode(shared_secret)
});

user.on('loggedOn', () => {
    console.log(user.steamID + ' - Бот вошёл в аккаунт');
    user.setPersona(status);
    refreshGames(); // Запускаем накрутку сразу после входа
});

// КЛЮЧЕВОЕ СОБЫТИЕ: Steam сообщает, что аккаунт используется для игры в другом месте
user.on('playingState', (blocked, app) => {
    playingOnOtherSession = blocked;

    if (blocked) {
        console.log(`Обнаружена игра на другом устройстве (AppID: ${app}). Накрутка на паузе.`);
    } else {
        console.log('Пользователь вышел из игры. Возобновляю накрутку.');
        refreshGames(); // Пользователь вышел — сразу возобновляем
    }
});

// Периодическое обновление статуса «в игре» (раз в 5 минут),
// чтобы Steam не сбрасывал его, пока пользователь не играет
setInterval(refreshGames, 5 * 60 * 1000);
