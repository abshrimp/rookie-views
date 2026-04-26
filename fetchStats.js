const fs = require('fs');
const axios = require('axios');
const { parseStringPromise } = require('xml2js');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    // 1. 動画リストの読み込み
    const videos = JSON.parse(fs.readFileSync('videos.json', 'utf-8'));
    const groupStats = {};

    console.log(`全 ${videos.length} 件のデータ取得を開始します...`);

    // 2. 0.3秒間隔でAPIからデータを取得
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
                    groupStats[video.group] = { totalViews: 0, totalMylists: 0, count: 0 };
                }

                groupStats[video.group].totalViews += views;
                groupStats[video.group].totalMylists += mylists;
                groupStats[video.group].count += 1;
                
                console.log(`[${i + 1}/${videos.length}] 取得成功: ${video.videoId}`);
            } else {
                console.log(`[${i + 1}/${videos.length}] データなし: ${video.videoId}`);
            }
        } catch (error) {
            console.error(`[${i + 1}/${videos.length}] エラー: ${video.videoId}`, error.message);
        }

        // API負荷対策：必ず0.3秒待機する
        await sleep(300);
    }

    // 3. グループごとの平均を計算
    const resultList = Object.keys(groupStats).map(group => {
        const data = groupStats[group];
        return {
            group: parseInt(group, 10),
            avg_view_counter: Math.round(data.totalViews / data.count),
            avg_mylist_counter: Math.round(data.totalMylists / data.count)
        };
    });

    // グループ番号順にソート
    resultList.sort((a, b) => a.group - b.group);

    // 4. 結果をJSONファイルとして保存（フロントエンドで読み込むため）
    // いつ取得したデータかわかるように最終更新日時を付与
    const outputData = {
        lastUpdated: new Date().toISOString(),
        stats: resultList
    };

    fs.writeFileSync('stats.json', JSON.stringify(outputData, null, 2), 'utf-8');
    console.log('集計が完了し、stats.json に保存されました。');
}

main();