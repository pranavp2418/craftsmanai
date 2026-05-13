"""Mock Redis for testing without Redis server"""

class MockRedis:
    def __init__(self, *args, **kwargs):
        self.data = {}
    
    def setex(self, key, ttl, value):
        self.data[key] = value
        return True
    
    def get(self, key):
        return self.data.get(key)
    
    def delete(self, key):
        return self.data.pop(key, None) is not None
    
    def exists(self, key):
        return key in self.data
    
    def ping(self):
        return True
    
    def keys(self, pattern):
        import fnmatch
        return [key for key in self.data.keys() if fnmatch.fnmatch(key, pattern)]
    
    @classmethod
    def from_url(cls, url):
        return cls()


# Mock the Redis module
import sys
import types

redis_module = types.ModuleType('redis')
redis_module.Redis = MockRedis
sys.modules['redis'] = redis_module
