const fs = require('fs');
const axios = require('axios');
const { parseStringPromise } = require('xml2js');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 中央値を計算するための関数
function getMedian(arr) {
    if (arr.length === 0) return 0;
    // 数値を小さい順（昇順）に並び替え
    arr.sort((a, b) => a - b);
    const mid = Math.floor(arr.length / 2);
    // データの個数が偶数の場合は真ん中2つの平均、奇数の場合は真ん中の値を返す
    if (arr.length % 2 === 0) {
        return Math.round((arr[mid - 1] + arr[mid]) / 2);
    } else {
        return arr[mid];
    }
}

async function main() {
    const videos = JSON.parse(fs.readFileSync('videos.json', 'utf-8'));
    const groupStats = {};

    console.log(`全 ${videos.length} 件のデータ取得を開始します...`);

    for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        try {
            const response = await axios.get(`https://ext.nicovideo.jp/api/getthumbinfo/${video.videoId}`);
            const result = await parseStringPromise(response.data);

            if (result.nicovideo_thumb_response.$.status === 'ok') {
                const thumb = result.nicovideo_thumb_response.thumb[0];
                const views = parseInt(thumb.view_counter[0], 10);
                const mylists = parseInt(thumb.mylist_counter[0], 10);

                if (!groupStats[video.group]) {
                    // 平均計算用の合計値だけでなく、中央値計算用にすべての値を配列で保存する
                    groupStats[video.group] = { 
                        totalViews: 0, totalMylists: 0, count: 0,
                        viewsArray: [], mylistsArray: [] 
                    };
                }

                groupStats[video.group].totalViews += views;
                groupStats[video.group].totalMylists += mylists;
                groupStats[video.group].count += 1;
                
                // 配列に値を追加
                groupStats[video.group].viewsArray.push(views);
                groupStats[video.group].mylistsArray.push(mylists);
                
                console.log(`[${i + 1}/${videos.length}] 取得成功: ${video.videoId}`);
            } else {
                console.log(`[${i + 1}/${videos.length}] データなし: ${video.videoId}`);
            }
        } catch (error) {
            console.error(`[${i + 1}/${videos.length}] エラー: ${video.videoId}`, error.message);
        }

        await sleep(300);
    }

    const resultList = Object.keys(groupStats).map(group => {
        const data = groupStats[group];
        return {
            group: parseInt(group, 10),
            // 平均値
            avg_view_counter: Math.round(data.totalViews / data.count),
            avg_mylist_counter: Math.round(data.totalMylists / data.count),
            // 中央値
            median_view_counter: getMedian(data.viewsArray),
            median_mylist_counter: getMedian(data.mylistsArray)
        };
    });

    resultList.sort((a, b) => a.group - b.group);

    const outputData = {
        lastUpdated: new Date().toISOString(),
        stats: resultList
    };

    fs.writeFileSync('stats.json', JSON.stringify(outputData, null, 2), 'utf-8');
    console.log('集計が完了し、stats.json に保存されました。');
}

main();