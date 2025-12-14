document.addEventListener('DOMContentLoaded', () => {
    runLevel(
      {
        ringCount: 5,
        ringSpeed: 2,
        timeLimit: 30000,
        targetSize: 5
      },
      {
        levelNumber: 1,
        scoreKey: 'level1_score',
        attemptKey: 'attempt1',
        nextUrl: 'level2.html',
        reloadUrl: 'level1.html'
      }
    );
  });
  