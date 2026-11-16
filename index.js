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
let reconnectAttempts = 0;

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
    reconnectAttempts++;
    // Постепенно увеличиваем интервал: 1 мин, 2 мин, 3 мин... но не больше 5 минут
    const wait = Math.min(delayMs * reconnectAttempts, 5 * 60 * 1000);
    console.log(`Планирую переподключение через ${Math.round(wait / 1000)} сек (попытка #${reconnectAttempts})...`);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        attemptLogOn();
    }, wait);
}

function attemptLogOn() {
    if (user.steamID) return; // уже в сети
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
    reconnectAttempts = 0;
    user.setPersona(status);
    refreshGames();
});

user.on('playingState', (blocked, app) => {
    if (playingOnOtherSession === blocked) return; // состояние не изменилось
    playingOnOtherSession = blocked;
    if (blocked) {
        console.log(`Обнаружена игра на другом устройстве (AppID: ${app}). Накрутка на паузе.`);
    } else {
        console.log('Пользователь вышел из игры. Возобновляю накрутку.');
        refreshGames();
    }
});

// ГЛАВНОЕ ИСПРАВЛЕНИЕ: перехват LoggedInElsewhere и других ошибок
user.on('error', (err) => {
    console.error('Ошибка Steam:', err.message, '| eresult:', err.eresult);

    if (err.eresult === 6) {
        // LoggedInElsewhere — вы играете на другом устройстве
        console.log('Сессия бота завершена, так как вы играете на другом устройстве. Жду выхода из игры...');
        playingOnOtherSession = true;
        scheduleReconnect(60000); // первая попытка через ~1 минуту
    } else {
        // Прочие ошибки (сеть, таймауты и т.д.)
        console.log('Неизвестная ошибка, планирую переподключение...');
        scheduleReconnect(30000);
    }
});

user.on('disconnected', (err, code) => {
    console.log('Соединение с Steam разорвано.', code ? `Код: ${code}` : '');
    if (!reconnectTimer && !user.steamID) {
        scheduleReconnect(30000);
    }
});

attemptLogOn();
setInterval(refreshGames, 5 * 60 * 1000);
