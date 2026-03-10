import fetch from 'node-fetch';
import fs from 'fs';
(async () => {
    try {
        const res = await fetch('http://localhost:3001/api/order-detail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ billcode: 'JX7452146726' })
        });
        const json = await res.json();
        fs.writeFileSync('out.json', JSON.parse(json.data) ? JSON.stringify(JSON.parse(json.data), null, 2) : json.data);
    } catch (e) {
        console.error(e);
    }
})();
