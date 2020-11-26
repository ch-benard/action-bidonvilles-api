const loaders = require('#server/loaders');
const { port } = require('#server/config');
const { backUrl } = require('#server/config');
module.exports = {
    start() {
        const app = loaders.express();
        loaders.routes(app);

        app.listen(port, () => {
            console.log(`Node is now running the API on ${backUrl}! :)`);
        });
    },
};