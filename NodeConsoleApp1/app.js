const { Telegraf, Markup, session } = require('telegraf');
const fs = require('fs');
const fileName = 'database.txt'
// Уровни разговора
const GENDER = 0;
const GENDERPREFERENCE = 1;
const NAME = 2;
const PREFERENCES = 3;
const USER = 4;
const AGREEMENT = 5;

//руглярное выражения всех видов строк
const regexAllMes = /(.+)/;
let users = [];

if (fs.existsSync('users.json')) {
    let data = fs.readFileSync('users.json');
    users = JSON.parse(data);
}

// Создайте экземпляр бота
const bot = new Telegraf('6659929844:AAHimT0xVaQKovHtSIXhNQmj5cCNg9F-YcM');
bot.use(session());
console.log("Booted up!")

// Обработчик команды /start
bot.command('start', (ctx) => {
    console.log(ctx.chat.id, "uses /start.");
    ctx.session = ctx.session || {};
    ctx.session.state = GENDER
    for (const user of users) {
        if (user.chatid === ctx.chat.id) {
            console.log(ctx.chat.id, "already registered!");
            ctx.session = user ? { ...user, ...ctx.session, state: USER } : { ...ctx.session, state: USER };
            console.log(ctx.session);
        }
    }

    if (ctx.session.state === GENDER) {
        console.log(ctx.chat.id, "not registered! Starting registration!");
        const replyKeyboard = Markup.keyboard(['male', 'women']).oneTime().resize();
        ctx.reply('pick a sex', replyKeyboard);
    }

    if (ctx.session.state === USER) {
        const replyKeyboard = Markup.keyboard(['search', 'registration']).oneTime().resize();
        ctx.reply("You're returned?", replyKeyboard)
    }
});

// Обработчик выбора пола
bot.hears(['male', 'women'], (ctx) => {
    const text = ctx.message.text;
    ctx.session = ctx.session || {};

    if (ctx.session.state === GENDERPREFERENCE) {
        ctx.session.genderpreference = text;
        console.log(ctx.chat.id, "picks a", text, "gender preference.");
        ctx.reply('pick a name')
        ctx.session.state = NAME;
    }

    if (ctx.session.state === GENDER) {
        ctx.session.gender = text
        console.log(ctx.chat.id, "picks a", text, "gender.");
        const replyKeyboard = Markup.keyboard(['male', 'women']).oneTime().resize();
        ctx.reply('pick a gender preference', replyKeyboard);
        ctx.session.state = GENDERPREFERENCE;
    }
});

bot.hears(['search'], (ctx) => {
    console.log(ctx.chat.id, "uses searching.");
    if (ctx.session.state === USER) { showUsers(ctx) };
});

bot.hears(['registration'], (ctx) => {
    if (ctx.session.state === USER) {
        ctx.session.state = AGREEMENT;
        const replyKeyboard = Markup.keyboard(['Yes', 'No']).oneTime().resize();
        ctx.reply('Are you sure?', replyKeyboard);
    }
});

bot.hears(['Yes'], (ctx) => {
    if (ctx.session.state === AGREEMENT) {
        console.log(ctx.chat.id, "Started re-registration!");
        for (const user of users) {
            if (user.chatid === ctx.chat.id) {
                users.splice(user, 1);
                console.log("Succesfully remove", ctx.chat.id, "record.");
            }
        }

        ctx.session.state = GENDER;
        const replyKeyboard = Markup.keyboard(['male', 'women']).oneTime().resize();
        ctx.reply('pick a sex', replyKeyboard);
    }
});

bot.hears(['No'], (ctx) => {
    if (ctx.session.state === AGREEMENT) {
        ctx.session.state = USER;
        const replyKeyboard = Markup.keyboard(['search', 'registration']).oneTime().resize();
        ctx.reply("What's next?", replyKeyboard)
    }
});

// Обработчик ввода имени
bot.hears(regexAllMes, (ctx) => {
    const text = ctx.message.text;
    ctx.session = ctx.session || {};


    if (ctx.session.state === PREFERENCES) {
        const hobbies = text.split(' ');
        ctx.session.hobbies = hobbies;
        console.log(ctx.chat.id, "picks a", hobbies, "hobbies.");

        // Записываем пользователя в массив users
        const userData = {
            name: ctx.session.name,
            gender: ctx.session.gender,
            hobbies: ctx.session.hobbies,
            genderpreference: ctx.session.genderpreference,
            chatid: ctx.chat.id
        };

        users.push(userData);
        console.log("Succesfully added record of", ctx.chat.id);
        ctx.session.state = USER;
        fs.writeFileSync('users.json', JSON.stringify(users, null, 2));

        showUsers(ctx);

        // Завершаем беседу
        /*        ctx.session = {};*/
    }

    if (ctx.session.state === NAME) {
        ctx.session.name = text;
        ctx.session.state = PREFERENCES;
        console.log(ctx.chat.id, "picks a", text, "name.");

        const replyKeyboard = Markup.keyboard(['communication', 'dating', 'sex']).oneTime().resize();
        ctx.reply('pick hobbies', replyKeyboard);
    }

});

// Обработчик команды /cancel
bot.command('cancel', (ctx) => {
    ctx.reply('cancel');
    ctx.session = {};
});

// Вывод списка пользователей
function showUsers(ctx) {
    ctx.session = ctx.session || {};
    const name = ctx.session.name;
    const hobbies = ctx.session.hobbies || [];
    const gender = ctx.session.gender;
    const genderpreference = ctx.session.genderpreference;
    const currentUser = users.find(user => user.chatid === ctx.chat.id);
    const matches = users.filter(user => {
        let isMatch = true;
        for (const hobby of hobbies) {
            if (!user.hobbies.includes(hobby)) {
                isMatch = false;
                break;
            }
        }
        return (
            isMatch &&
            user.gender === genderpreference &&
            user.genderpreference === gender &&
            user.name !== name
        );
    });

    if (matches.length > 0) {
        let message = "Here are some matches for you:\n\n";
        for (const match of matches) {
            message += `Name: ${match.name}\n`;
            message += `Gender: ${match.gender}\n`;
            message += `Hobbies: ${match.hobbies.join(", ")}\n\n`;
            message += `Gender preference: ${match.genderpreference}\n`;
        }
        ctx.reply(message);
    } else {
        ctx.reply("Sorry, no matches found.");
    }

    console.log("Showing search record to", ctx.chat.id);
    const replyKeyboard = Markup.keyboard(['search', 'registration']).oneTime().resize();
    ctx.reply("What's next?", replyKeyboard);
}

process.on('beforeExit', () => {
    fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
});

// Запуск бота
bot.launch();
/*
1. Кириллица!!!
2. Подвязка датабазы
3. выбери фотку
4. расскажи о себе
*. Баг с командой search при старте бота


*/