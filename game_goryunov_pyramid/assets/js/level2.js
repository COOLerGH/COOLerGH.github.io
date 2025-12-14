document.addEventListener('DOMContentLoaded', () => {
    runLevel(
      {
        ringCount: 7,
        ringSpeed: 3,
        timeLimit: 45000,
        targetSize: 7
      },
      {
        levelNumber: 2,
        scoreKey: 'level2_score',
        attemptKey: 'attempt2',
        nextUrl: 'level3.html',
        reloadUrl: 'level2.html'
      }
    );
  });
  