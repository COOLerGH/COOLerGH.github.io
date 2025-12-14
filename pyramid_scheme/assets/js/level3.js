document.addEventListener('DOMContentLoaded', () => {
    runLevel(
      {
        ringCount: 9,
        ringSpeed: 4,
        timeLimit: 60000,
        targetSize: 9
      },
      {
        levelNumber: 3,
        scoreKey: 'level3_score',
        attemptKey: 'attempt3',
        nextUrl: 'results.html',
        reloadUrl: 'level3.html'
      }
    );
  });
  