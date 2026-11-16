const steamUser = require('steam-user');
const steamTotp = require('steam-totp');
require('./keep_alive.js');

const username = process.env.login;
const password = process.env.password;
const shared_secret = process.env.shared;

const games = [730];
const status = 7;

const user = new steamUser();

let playingOnOtherSession = false;
let reconnectTimer = null;

function refreshGames() {
    if (playingOnOtherSession) {
        console.log('Пользователь играет на другом устройстве. Накрутка приостановлена.');
        return;
    }
    if (user.steamID) {
        user.gamesPlayed(games);
        console.log('Накрутка активна: ' + games.join(', '));
    }
}

function scheduleReconnect(delayMs) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    console.log(`Планирую переподключение через ${Math.round(delayMs / 1000)} сек...`);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        attemptLogOn();
    }, delayMs);
}

function attemptLogOn() {
    if (user.steamID) return;
    console.log('Попытка входа в Steam...');
    try {
        user.logOn({
            accountName: username,
            password: password,
            twoFactorCode: steamTotp.generateAuthCode(shared_secret)
        });
    } catch (e) {
        console.error('Ошибка при вызове logOn:', e.message);
        scheduleReconnect(60000);
    }
}

user.on('loggedOn', () => {
    console.log(user.steamID + ' - Бот вошёл в аккаунт');
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    user.setPersona(status);
    refreshGames();
});

user.on('playingState', (blocked, app) => {
    if (playingOnOtherSession === blocked) return;
    playingOnOtherSession = blocked;
    if (blocked) {
        console.log(`Обнаружена игра на другом устройстве (AppID: ${app}). Накрутка на паузе.`);
    } else {
        console.log('Пользователь вышел из игры. Возобновляю накрутку.');
        refreshGames();
    }
});

user.on('error', (err) => {
    console.error('Ошибка Steam:', err.message, '| eresult:', err.eresult);

    if (err.eresult === 6) {
        // LoggedInElsewhere — вы играете
        console.log('Сессия бота завершена (вы играете). Жду выхода из игры, проверяю каждую минуту...');
        playingOnOtherSession = true;
        scheduleReconnect(60 * 1000); // Строго 1 минута
    } else if (err.eresult === 84 || err.eresult === 87) {
        // RateLimitExceeded — Steam временно ограничил вход
        console.log('Steam временно ограничил вход. Жду 15 минут...');
        playingOnOtherSession = true;
        scheduleReconnect(15 * 60 * 1000); // Строго 15 минут
    } else {
        console.log('Неизвестная ошибка, планирую переподключение...');
        scheduleReconnect(60 * 1000);
    }
});

user.on('disconnected', (err, code) => {
    console.log('Соединение с Steam разорвано.', code ? `Код: ${code}` : '');
    if (!reconnectTimer && !user.steamID) {
        scheduleReconnect(60000);
    }
});

attemptLogOn();
setInterval(refreshGames, 5 * 60 * 1000);
