document.addEventListener('DOMContentLoaded', function() {
    let button_theme = document.getElementById('change_theme');
    let theme = document.getElementById('theme');

    // применяем сохранённую тему сразу при загрузке
    let currentTheme = localStorage.getItem('theme') || 'assets/css/light.css';
    theme.href = currentTheme;

    // важно: сообщаем всем страницам/скриптам, что тема уже применена
    // (иначе некоторые элементы могут раскраситься по умолчанию и не обновиться до ручного переключения)
    document.dispatchEvent(new Event('themeChanged'));

    if (button_theme) {
        button_theme.onclick = function changeTheme() {
            if (theme.href.includes('light.css')) {
                theme.href = 'assets/css/dark.css';
                localStorage.setItem('theme', 'assets/css/dark.css');
            } else {
                theme.href = 'assets/css/light.css';
                localStorage.setItem('theme', 'assets/css/light.css');
            }

            const themeChangedEvent = new Event('themeChanged');
            document.dispatchEvent(themeChangedEvent);
        };
    }
});
