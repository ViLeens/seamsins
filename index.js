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
let loginTimeout = null;

function refreshGames() {
    if (playingOnOtherSession) return;
    if (user.steamID) {
        user.gamesPlayed(games);
        console.log('Накрутка активна: ' + games.join(', '));
    }
}

function scheduleReconnect(delayMs) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    console.log(`Планирую переподключение через ${Math.round(delayMs / 60000)} мин...`);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        attemptLogOn();
    }, delayMs);
}

function attemptLogOn() {
    if (user.steamID) return; 
    console.log('Попытка входа в Steam...');

    if (loginTimeout) clearTimeout(loginTimeout);
    loginTimeout = setTimeout(() => {
        console.log('Таймаут входа (30 сек). Steam не ответил, переподключаюсь...');
        user.logOff(); 
        playingOnOtherSession = true;
        scheduleReconnect(5 * 60 * 1000); // Если таймаут - ждем 5 минут
    }, 30000);

    try {
        user.logOn({
            accountName: username,
            password: password,
            twoFactorCode: steamTotp.generateAuthCode(shared_secret)
        });
    } catch (e) {
        console.error('Ошибка при вызове logOn:', e.message);
        scheduleReconnect(5 * 60 * 1000);
    }
}

user.on('loggedOn', () => {
    console.log(user.steamID + ' - Бот вошёл в аккаунт');
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (loginTimeout) { clearTimeout(loginTimeout); loginTimeout = null; }
    
    playingOnOtherSession = false; 
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
    
    if (loginTimeout) { clearTimeout(loginTimeout); loginTimeout = null; }

    if (err.eresult === 6) {
        // ВЫ ИГРАЕТЕ. Ждем 10 минут, чтобы не спамить Steam
        console.log('Сессия завершена (вы играете). Следующая проверка через 10 минут...');
        playingOnOtherSession = true;
        scheduleReconnect(10 * 60 * 1000); // 10 минут
    } else if (err.eresult === 84 || err.eresult === 87) {
        // Лимит запросов
        console.log('Steam временно ограничил вход. Жду 30 минут...');
        playingOnOtherSession = true;
        scheduleReconnect(30 * 60 * 1000); // 30 минут
    } else {
        console.log('Неизвестная ошибка, планирую переподключение через 5 минут...');
        scheduleReconnect(5 * 60 * 1000);
    }
});

user.on('disconnected', (err, code) => {
    console.log('Соединение с Steam разорвано.', code ? `Код: ${code}` : '');
    if (loginTimeout) { clearTimeout(loginTimeout); loginTimeout = null; }
    if (!reconnectTimer && !user.steamID) {
        playingOnOtherSession = true;
        scheduleReconnect(5 * 60 * 1000);
    }
});

// Сторожевой таймер
setInterval(() => {
    if (!user.steamID) return; 

    let isAlive = false;
    const pingTimeout = setTimeout(() => {
        if (!isAlive) {
            console.log('⚠️ Таймаут ответа от Steam (зомби-сессия). Принудительно переподключаюсь...');
            user.logOff(); 
            playingOnOtherSession = true;
            scheduleReconnect(5 * 60 * 1000); 
        }
    }, 15000); 

    user.getPersonas([user.steamID], (err) => {
        isAlive = true;
        clearTimeout(pingTimeout);
        if (err) console.error('Ошибка пинга:', err.message);
    });
}, 60000); 

setInterval(refreshGames, 5 * 60 * 1000);

attemptLogOn();
