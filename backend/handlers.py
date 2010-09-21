# Copyright 2009-2010 10gen, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from pymongo import Connection, json_util, ASCENDING, DESCENDING
from pymongo.son import SON
from pymongo.errors import ConnectionFailure, OperationFailure, AutoReconnect

import re
try:
    import json
except ImportError:
    import simplejson as json


class MongoHandler:
    mh = None

    _cursor_id = 0

    def __init__(self, mongos):
        self.connections = {}

    def _get_connection(self, name = None, host = None, port = None):
        if name == None and host == None:
            if not ('stats' in self.cluster):
                return None

            stats = self.cluster['stats']

            if not ('mongos' in stats):
                return None

            # iterate through all mongos if one isn't connected
            for mongos in stats['mongos']:
                conn = self._get_connection(mongos['name'])
                if conn != None:
                    return conn

        if name != None and name in self.connections:
            return self.connections[name]

        if port == None:
            port = 27107

        try:
            connection = Connection(host = host, port = port, network_timeout = 2, slave_okay = True)
        except ConnectionFailure:
            return None

        self.connections[name] = connection
        return connection


    def _get_host_and_port(self, server):
        host = "localhost"
        port = 27017

        if len(server) == 0:
            return (host, port)

        m = re.search('([^:]+)(?::([0-9]+))?', server)
        if m == None:
            return (host, port)

        handp = m.groups()

        if len(handp) >= 1:
            host = handp[0]
        if len(handp) == 2 and handp[1] != None:
            port = int(handp[1])

        return (host, port)
        
    def _connect(self, args, out):
        if not "host" in args:
            out('{"ok" : false, "message" : "host must be given"}')
            return

        (host, port) = self._get_host_and_port(args.getvalue('host'))
        name = "%s%d" % (host, port)

        conn = self._get_connection(name, host, port)
        if conn == None:
            out('{"ok" : false, "message" : "could not connect to %s:%d"}' % (host, port))
            return

        out('{"ok" : true, "name" : "%s"}' % name);


    def _config(self, args, out):
        for i in self.connections:
            result = self.connections[i]['local']['system']['replset'].find_one();
            if result != None:
                out(json.dumps(result));
                return

        out('{"ok" : false, "message" : "could not find config"}')


    def run_command(self, cmd, out):
        for i in self.connections:
            result = self.connections[i]['admin'].command(cmd, check = False);
            if result['ok']:
                out(json.dumps(result));
                return

        out('{"ok" : false}')


    def _initialize(self, args, out):
        if not "config" in args:
            out('{"ok" : false, "message" : "must give config"}');

        config = json.loads(args.getvalue('config'), object_hook=json_util.object_hook)

        self.run_command({"replSetInitiate" : config}, out)


    def _reconfigure(self, args, out):
        if not "config" in args:
            out('{"ok" : false, "message" : "must give config"}');

        config = json.loads(args.getvalue('config'), object_hook=json_util.object_hook)

        self.run_command({"replSetReconfig" : config}, out)

