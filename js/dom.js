// Данные теста
const testData = [
    {
        question: "Если человека назвали мордофиля, то это...",
        answers: [
            { text: "Значит, что он тщеславный.", correct: true, explanation: "Ну зачем же вы так... В Этимологическом словаре русского языка Макса Фасмера поясняется, что мордофилей называют чванливого человека. Ну а «чванливый» — это высокомерный, тщеславный." },
            { text: "Значит, что у него лицо как у хряка.", correct: false },
            { text: "Значит, что чумазый.", correct: false }
        ]
    },
    {
        question: "«Да этот Ярополк — фуфлыга!» Что не так с Ярополком?",
        answers: [
            { text: "Он маленький и невзрачный.", correct: true, explanation: "Точно! Словарь Даля говорит, что фуфлыгой называют невзрачного малорослого человека. А еще так называют прыщи." },
            { text: "Он тот еще алкоголик.", correct: false },
            { text: "Он не держит свое слово.", correct: false }
        ]
    },
    {
        question: "Если человека прозвали пятигузом, значит, он...",
        answers: [
            { text: "Не держит слово.", correct: true, explanation: "Может сесть сразу на пять стульев. Согласно Этимологическому словарю русского языка Макса Фасмера, пятигуз — это ненадежный, непостоянный человек." },
            { text: "Изменяет жене", correct: false },
            { text: "Без гроша в кармане.", correct: false }
        ]
    },
    {
        question: "Кто такой шлындра?",
        answers: [
            { text: "Обманщик.", correct: false },
            { text: "Нытик.", correct: false },
            { text: "Бродяга.", correct: true, explanation: "Да! В Словаре русского арго «шлындрать» означает бездельничать, шляться." }
        ]
    }
];

let currentQuestions = [];
let currentQuestionIndex = 0;
let correctAnswersCount = 0;
let answeredQuestions = [];
let isAnswerSelected = false;

// Инициализация теста
function initTest() {
    // Перемешивание вопросов
    currentQuestions = [...testData].sort(() => Math.random() - 0.5);
    currentQuestionIndex = 0;
    correctAnswersCount = 0;
    answeredQuestions = [];
    isAnswerSelected = false;
    
    // Очистка
    document.getElementById('testArea').innerHTML = '';
    document.getElementById('stats').style.display = 'none';
    document.getElementById('questionHistory').style.display = 'none';
    
    showQuestion();
}

// Показать текущий вопрос
function showQuestion() {
    const testArea = document.getElementById('testArea');
    
    if (currentQuestionIndex >= currentQuestions.length) {
        showCompletionScreen();
        return;
    }
    
    const question = currentQuestions[currentQuestionIndex];
    const questionNumber = currentQuestionIndex + 1;
    
    // Контейнер для вопроса
    const questionContainer = document.createElement('div');
    questionContainer.className = 'question-container';
    questionContainer.id = `question-${currentQuestionIndex}`;
    
    // Номер и текст вопроса
    const questionHTML = `
        <div class="question-text">
            <span class="question-number">${questionNumber}</span>
            ${question.question}
        </div>
        <div class="answers-container">
            ${getAnswersHTML(question.answers)}
        </div>
    `;
    
    questionContainer.innerHTML = questionHTML;
    testArea.appendChild(questionContainer);
    
    // Обработчики событий для ответов
    const answers = questionContainer.querySelectorAll('.answer');
    answers.forEach(answer => {
        answer.addEventListener('click', handleAnswerClick);
    });
}

// Показать экран завершения теста
function showCompletionScreen() {
    const testArea = document.getElementById('testArea');
    
    const completionHTML = `
        <div class="no-questions">
            <div class="completion-message">Вопросы закончились</div>
            <button class="retry-button" onclick="location.reload()">Попробовать ещё раз</button>
        </div>
    `;
    
    testArea.innerHTML = completionHTML;
    showStats();
    showQuestionHistory();
}

// Генерация HTML для ответов
function getAnswersHTML(answers) {
    // Перемешивание ответов
    const shuffledAnswers = [...answers].sort(() => Math.random() - 0.5);
    
    return shuffledAnswers.map((answer, index) => {
        return `
            <div class="answer" data-correct="${answer.correct}" data-index="${index}" data-explanation="${answer.explanation || ''}">
                ${answer.text}
            </div>
        `;
    }).join('');
}

// Обработчик клика на ответ
function handleAnswerClick(e) {
    if (isAnswerSelected) return;
    
    const answerElement = e.currentTarget;
    const isCorrect = answerElement.getAttribute('data-correct') === 'true';
    const questionContainer = answerElement.closest('.question-container');
    
    isAnswerSelected = true;
    
    // Класс выбранного ответа
    answerElement.classList.add('selected');
    
    // Тряска для всех ответов
    const allAnswers = questionContainer.querySelectorAll('.answer');
    allAnswers.forEach(answer => {
        answer.classList.add('shake');
    });
    
    setTimeout(() => {
        processAnswer(answerElement, isCorrect, questionContainer);
    }, 500);
}

// Обработка ответа
function processAnswer(answerElement, isCorrect, questionContainer) {
 
    const allAnswers = questionContainer.querySelectorAll('.answer');
    allAnswers.forEach(answer => {
        answer.classList.remove('shake');
    });
    
    // Маркер правильности
    const questionText = questionContainer.querySelector('.question-text');
    const marker = document.createElement('span');
    marker.className = `marker ${isCorrect ? 'correct-marker' : 'incorrect-marker'}`;
    marker.textContent = isCorrect ? '✓' : '✗';
    questionText.appendChild(marker);
    
    if (isCorrect) {
        // Правильный ответ
        correctAnswersCount++;
        answerElement.classList.add('correct');
        
        const explanation = answerElement.getAttribute('data-explanation');
        if (explanation) {
            const explanationElement = document.createElement('div');
            explanationElement.className = 'explanation';
            explanationElement.textContent = explanation;
            explanationElement.style.display = 'block';
            answerElement.appendChild(explanationElement);
            answerElement.style.minHeight = '100px';
        }
        

        allAnswers.forEach(answer => {
            if (answer !== answerElement && answer.getAttribute('data-correct') === 'false') {
                answer.classList.add('slide-down');
            }
        });
        

        answeredQuestions.push({
            question: currentQuestions[currentQuestionIndex].question,
            userAnswer: answerElement.textContent.trim(),
            correctAnswer: currentQuestions[currentQuestionIndex].answers.find(a => a.correct).text,
            explanation: currentQuestions[currentQuestionIndex].answers.find(a => a.correct).explanation,
            isCorrect: true
        });
        

        setTimeout(() => {
            answerElement.classList.add('slide-down');
            

            setTimeout(() => {
                currentQuestionIndex++;
                isAnswerSelected = false;
                showQuestion();
            }, 800);
        }, 2000);
        
    } else {
        // Неправильный ответ
        answerElement.classList.add('incorrect');
        

        answeredQuestions.push({
            question: currentQuestions[currentQuestionIndex].question,
            userAnswer: answerElement.textContent.trim(),
            correctAnswer: currentQuestions[currentQuestionIndex].answers.find(a => a.correct).text,
            explanation: currentQuestions[currentQuestionIndex].answers.find(a => a.correct).explanation,
            isCorrect: false
        });
        

        setTimeout(() => {
            allAnswers.forEach(answer => {
                answer.classList.add('slide-down');
            });
            

            setTimeout(() => {
                currentQuestionIndex++;
                isAnswerSelected = false;
                showQuestion();
            }, 800);
        }, 2000);
    }
}

// Показать статистику
function showStats() {
    const stats = document.getElementById('stats');
    const statsText = document.getElementById('statsText');
    
    statsText.textContent = `Вы ответили правильно на ${correctAnswersCount} из ${currentQuestions.length} вопросов`;
    stats.style.display = 'block';
}

// Показать историю вопросов
function showQuestionHistory() {
    const questionHistory = document.getElementById('questionHistory');
    questionHistory.style.display = 'block';
    
    let historyHTML = '';
    
    answeredQuestions.forEach((item, index) => {
        historyHTML += `
            <div class="history-item" onclick="toggleHistoryAnswer(${index})">
                <div class="history-question">
                    <span class="question-number">${index + 1}</span>
                    ${item.question}
                    <span class="marker ${item.isCorrect ? 'correct-marker' : 'incorrect-marker'}" style="margin-left: auto;">
                        ${item.isCorrect ? '✓' : '✗'}
                    </span>
                </div>
                <div class="history-answer" id="history-answer-${index}">
                    <strong>Ваш ответ:</strong> ${item.userAnswer}<br>
                    <strong>Правильный ответ:</strong> ${item.correctAnswer}<br>
                    ${item.explanation ? `<strong>Пояснение:</strong> ${item.explanation}` : ''}
                </div>
            </div>
        `;
    });
    
    questionHistory.innerHTML += historyHTML;
}

// Переключить отображение правильного ответа в истории
function toggleHistoryAnswer(index) {
    const answerElement = document.getElementById(`history-answer-${index}`);
    

    document.querySelectorAll('.history-answer').forEach(el => {
        if (el !== answerElement) {
            el.style.display = 'none';
        }
    });
    

    if (answerElement.style.display === 'block') {
        answerElement.style.display = 'none';
    } else {
        answerElement.style.display = 'block';
    }
}

// Инициализация теста при загрузке страницы
window.onload = initTest;