import fetch from 'node-fetch'

async function test() {
    const res = await fetch('http://localhost:3001/api/unmask-phones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billcodes: ['JX7452146726'] })
    })
    const json = await res.json()
    console.log(JSON.stringify(json, null, 2))
}

test()
