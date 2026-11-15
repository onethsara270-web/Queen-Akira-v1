const { cmd } = require('../command');

cmd({
    pattern: "iqtest",
    alias: ["iq", "iqcheck"],
    use: '.iqtest',
    desc: "Check your IQ randomly",
    category: "game",
    react: "🧠",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    const iqList = [
        'IQ Anda Sebesar : 1 🤡', 'IQ Anda Sebesar : 14 🤓', 'IQ Anda Sebesar : 35 😅',
        'IQ Anda Sebesar : 67 😐', 'IQ Anda Sebesar : 99 🙂', 'IQ Anda Sebesar : 150 😎',
        'IQ Anda Sebesar : 340 🤯', 'IQ Anda Sebesar : 500 🧠', 'IQ Anda Sebesar : 1000 🌟',
        'IQ Anda Sebesar : Tidak Terbatas! 👽', 'IQ Anda Sebesar : 10000 🚀'
    ];
    
    const randomIq = iqList[Math.floor(Math.random() * iqList.length)];
    reply(`🧠 *IQ TEST* 🧠\n\n${randomIq}`);
});
