const fs = require('fs');
const axios = require('axios');
const { parseStringPromise } = require('xml2js');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getMedian(arr) {
    if (arr.length === 0) return 0;
    arr.sort((a, b) => a - b);
    const mid = Math.floor(arr.length / 2);
    if (arr.length % 2 === 0) {
        return Math.round((arr[mid - 1] + arr[mid]) / 2);
    } else {
        return arr[mid];
    }
}

async function main() {
    const videos = JSON.parse(fs.readFileSync('videos.json', 'utf-8'));
    const groupStats = {};
    
    let globalTotalViews = 0;
    let globalTotalMylists = 0;
    const globalViewsArray = [];
    const globalMylistsArray = [];

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

                // --- グループ別の集計 ---
                if (!groupStats[video.group]) {
                    groupStats[video.group] = { 
                        totalViews: 0, totalMylists: 0, count: 0,
                        viewsArray: [], mylistsArray: [] 
                    };
                }
                groupStats[video.group].totalViews += views;
                groupStats[video.group].totalMylists += mylists;
                groupStats[video.group].count += 1;
                groupStats[video.group].viewsArray.push(views);
                groupStats[video.group].mylistsArray.push(mylists);
                
                // --- 全体の集計 ---
                globalTotalViews += views;
                globalTotalMylists += mylists;
                globalViewsArray.push(views);
                globalMylistsArray.push(mylists);
                
                console.log(`[${i + 1}/${videos.length}] 取得成功: ${video.videoId}`);
            } else {
                console.log(`[${i + 1}/${videos.length}] データなし: ${video.videoId}`);
            }
        } catch (error) {
            console.error(`[${i + 1}/${videos.length}] エラー: ${video.videoId}`, error.message);
        }

        await sleep(200);
    }

    // グループごとの結果を整形
    const resultList = Object.keys(groupStats).map(group => {
        const data = groupStats[group];
        return {
            group: parseInt(group, 10),
            avg_view_counter: Math.round(data.totalViews / data.count),
            avg_mylist_counter: Math.round(data.totalMylists / data.count),
            median_view_counter: getMedian(data.viewsArray),
            median_mylist_counter: getMedian(data.mylistsArray)
        };
    });

    resultList.sort((a, b) => a.group - b.group);

    // 全体の結果を整形
    const globalStats = {
        total_videos: globalViewsArray.length,
        avg_view_counter: Math.round(globalTotalViews / globalViewsArray.length) || 0,
        median_view_counter: getMedian(globalViewsArray),
        avg_mylist_counter: Math.round(globalTotalMylists / globalMylistsArray.length) || 0,
        median_mylist_counter: getMedian(globalMylistsArray)
    };

    const outputData = {
        lastUpdated: new Date().toISOString(),
        global: globalStats,
        stats: resultList
    };

    fs.writeFileSync('stats.json', JSON.stringify(outputData, null, 2), 'utf-8');
    console.log('集計が完了し、stats.json に保存されました。');
}

main();
