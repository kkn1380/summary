import http from 'http';
import { monitor } from './monitor.js';

const port = process.env.PORT ? Number(process.env.PORT) : 8080;
let running = false;

const server = http.createServer(async (req, res) => {
    if (req.url === '/run' && req.method === 'POST') {
        if (running) {
            res.statusCode = 429;
            res.end('already running');
            return;
        }
        running = true;
        try {
            await monitor();
            res.statusCode = 200;
            res.end('ok');
        } catch (err: any) {
            res.statusCode = 500;
            res.end(err?.message || 'error');
        } finally {
            running = false;
        }
        return;
    }

    // health/default
    res.statusCode = 200;
    res.end('healthy');
});

server.listen(port, () => {
    console.log(`HTTP server listening on ${port}`);
});
