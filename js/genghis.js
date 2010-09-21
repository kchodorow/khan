/*
 * Copyright 2010 10gen, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

var ReplicaSet = function() {
  this.config = {
    "_id" : "",
    "members" : []
  };

  this.servers = [];
  this.trackDuplicates = {};
};

ReplicaSet.prototype.setName = function() {
  this.config._id = $("#rs-name").val();
};

ReplicaSet.prototype.getServer = function(input) {
  var index = View.getIndex(input);
  if (!this.servers[index]) {
    this.servers[index] = {};
  }
  
  return this.servers[index];
};

  
ReplicaSet.prototype.setHost = function(input) {
  this.getServer(input).host = input.value;

  if (input.value == "") {
    return;
  }

  if (this.trackDuplicates[input.value]) {
    input.value = "";
    $(input).focus();
    return;
  }

  this.trackDuplicates[input.value] = true;
  
  $.ajax({
        "url" : "/_connect",
        "type" : "POST",
        "data" : {"host" : input.value},
        "dataType" : "json",
        "context" : input,
        "success" : this.confirmConnect,
         });
  
  // add a new host box, if necessary
  View.addHostDiv(input);
};

ReplicaSet.prototype.setArbiter = function(input) {
  // we might want to set OR unset "arbiterOnly"
  this.getServer(input).arbiterOnly = this.checked;
};

ReplicaSet.prototype.setPassive = function(input) {
  // we might want to set OR unset priority
  this.getServer(input).priority = (this.checked ? 0 : 1);
};

ReplicaSet.prototype.initialize = function() {
  // count might differ from i, if hosts have been removed
  var count = 0;
  var dup = {};
  for (var i in this.servers) {
    if (this.servers[i].host == "") {
      continue;
    }
    
    this.config.members[count] = {
      "_id" : count,
      "host" : this.servers[i].host,
    }
    if (this.servers[count].arbiterOnly) {
      this.config.members[count].arbiterOnly = true;
    }
    if (this.servers[count].priority == 0) {
      this.config.members[count].priority = 0;
    }

    count++;
  }

  $.post("/_initialize", {'config' : $.toJSON(this.config)}, this.confirmConfig, "json");
};

ReplicaSet.prototype.confirmConnect = function(msg) {
  var icon = $(this).parent().find(".icon");
  
  if (!msg || !msg.ok) {
    icon.button({icons: { primary: 'ui-icon-closethick' }});
  }
  else {
    icon.button({icons: { primary: 'ui-icon-check' }});
  }
};

ReplicaSet.prototype.confirmConfig = function(msg) {
  if (!msg || !msg.ok) {
    View.showError(msg);
    return;
  }

  $("#rs-status").append(msg.message);  
};

View = {
  hostDivs : -1,
  ERROR : "error",
  SERVER_ERROR : "server error",
  UNKNOWN_ERROR : "unknown error",
};

View.getIndex = function(input) {
  return parseInt(input.id.substring(1));
}

View.addHostDiv = function(prev) {
  // ids are of the form hN
  if (View.getIndex(prev) < View.hostDivs) {
    return;
  }

  var server = View.getPiece("/pieces/server.html");

  // add a new div
  $(prev).parent().after(server);

  $(".host").focusout(function() {
    rs.setHost(this);
  });

  $(".arb").focusout(function() {
    rs.setArbiter(this);
  });

  $(".passive").focusout(function() {
    rs.setPassive(this);
  });

  View.hostDivs++;  
};

View.getPiece = function(uri) {
  var str;
  $.ajax({
      "async" : false,
      "url" : uri,
      "success" : function(data) {
        str = data;
      }
    });

  return $(str);
};

View.showError = function(obj) {
  var title, msg;
  if (!obj) {
    title = View.SERVER_ERROR;
    msg = "no server response.";
  }
  else if (!obj.ok) {
    if (obj.errmsg) {
      title = View.ERROR;
      msg = obj.errmsg;
    }
    else if (obj.msg) {
      title = View.ERROR;
      msg = obj.msg;
    }
    else {
      title = View.UNKNOWN_ERROR;
      msg = $.toJSON(obj);
    }
  }
  else {
    return;
  }
        
  $("#error-dialog").attr("title", title);
  $("#error-dialog").html("<p>"+msg+"</p>");    
  $("#error-dialog").dialog({
      'buttons' : {"try again" : function() { $(this).dialog("close"); }},
        });        
};
