#!/bin/sh
set -e
envsubst < /home/node/rb/api/db/config/config.js.sample > /home/node/rb/api/db/config/config.js
# cat /home/node/rb/api/db/config/config.js
envsubst < /home/node/rb/api/server/config.js.sample > /home/node/rb/api/server/config.js
# cat /home/node/rb/api/server/config.js
chown -R node /home/node/rb/api/
# This does more or less exactly the same thing as gosu but it's 10kb for  instead of 1.8MB:
exec su-exec node "$@"