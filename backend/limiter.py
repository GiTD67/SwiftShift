import os

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Use a shared store (Redis) when REDIS_URL is set so rate limits hold ACROSS
# gunicorn workers. With the in-memory default each of the N workers keeps its
# own counter, so the effective limit is N× the configured value (e.g. 4 workers
# turn "10 per minute" into 40). Falls back to per-process memory for local/dev.
_storage_uri = (
    os.environ.get("RATELIMIT_STORAGE_URI")
    or os.environ.get("REDIS_URL")
    or "memory://"
)

limiter = Limiter(key_func=get_remote_address, storage_uri=_storage_uri)
