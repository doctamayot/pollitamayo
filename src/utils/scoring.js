export const calculatePoints = (prediction, realResult) => {
    if (!prediction || !realResult || prediction.home === '' || realResult.home === '' || isNaN(parseInt(prediction.home)) || isNaN(parseInt(prediction.away)) || isNaN(parseInt(realResult.home)) || isNaN(parseInt(realResult.away))) {
        return 0;
    }
    const predHome = parseInt(prediction.home, 10);
    const predAway = parseInt(prediction.away, 10);
    const realHome = parseInt(realResult.home, 10);
    const realAway = parseInt(realResult.away, 10);

    if (predHome === realHome && predAway === realAway) return 6;
    
    let points = 0;
    const predWinner = predHome > predAway ? 'H' : (predAway > predHome ? 'A' : 'D');
    const realWinner = realHome > realAway ? 'H' : (realAway > realHome ? 'A' : 'D');

    if (predWinner === realWinner) points += 2;
    if (predHome === realHome) points += 1;
    if (predAway === realAway) points += 1;
    
    return points;
};