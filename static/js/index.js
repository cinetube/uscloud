var socket = io.connect();
var app = angular.module("app", []);

app.controller("main", function($scope, $timeout) {
    //Init
    $scope.visitedPages = {};
    $scope.torrents = {};
    $scope.currentSearchPage = 0;
    $scope.connected = false;
    $scope.search = { loading: false, results: null };
    $scope.incognito = false;
    //socket emits
    socket.on('setKey', function(data) {
        var name = data.name;
        var key = data.key;
        var value = data.value;
        $timeout(function() {
            if (data.ignore && $scope[name][key] && typeof (value) == "object") {
                var ignoreKeys = data.ignore;
                var keys = Object.keys(value);
                keys.forEach(function(k) {
                    if (!(ignoreKeys.includes(k) && $scope[name][key][k])) {
                        $scope[name][key][k] = value[k];
                    }
                })
            } else {
                $scope[name][key] = value;
            }
        });
    });
    socket.on('setObj', function(data) {
        var name = data.name;
        var value = data.value;
        $timeout(function() {
            $scope[name] = value;
        });
    })
    socket.on('deleteKey', function(data) {
        var name = data.name;
        var key = data.key;
        if ($scope[name][key]) {
            $timeout(function() {
                delete $scope[name][key];
            });
        }
    });
    socket.on('disconnect', function() {
        $timeout(function() {
            $scope.connected = false;
        });
    });
    socket.on('connect', function() {
        $timeout(function() {
            $scope.connected = true;
        });
    });
    //Functions
    $scope.togglePin = function(page) {
        if (page.pinned) {
            socket.emit('unpin', { page: page, isTorrent: page.isTorrent });
            page.pinned = false;
        } else {
            socket.emit('pin', { page: page, isTorrent: page.isTorrent });
            page.pinned = true;
        }
    }
    $scope.downloadToPC = function(page) {
        window.location.href = page.path;
    }
    $scope.downloadToDrive = function(page) {
        if (!(page.progress == 100 && $scope.status.logged)) {
            return false;
        }
        if (page.isTorrent) {
            page.msg = "Uploading to Drive";
            socket.emit('uploadDirToDrive', { id: page.id });
            return false;
        }
        var filename = prompt("Enter File Name: ");
        if (filename) {
            socket.emit('saveToDrive', { data: page, name: filename });
            $timeout(function() {
                $scope.visitedPages[page.id].msg = "Uploading To Drive";
            });
        }
    }
    $scope.clearVisitedPages = function() {
        Object.keys($scope.visitedPages).forEach((id) => {
            if (!$scope.visitedPages[id].pinned) {
                delete $scope.visitedPages[id];
            }
        });
        socket.emit('clearVisitedPages');
    }
    $scope.clearTorrents = function() {
        Object.keys($scope.torrents).forEach((id) => {
            if (!$scope.torrents[id].pinned) {
                delete $scope.torrents[id];
            }
        });
        socket.emit('clearTorrents');
    }
    $scope.redirectToLoginUrl = function(url) {
        if (!$scope.status.logged) {
            window.location = url;
        }
    }
    $scope.openUrl = function() {
        window.open(window.location.origin + '/proxy/' + $scope.url);
    }
    $scope.urlType = function() {
        if ($scope.url) {
            var url = $scope.url;
            if (url.startsWith('http')) {
                return 'url';
            } else if (url.startsWith('magnet:')) {
                return 'magnet';
            } else {
                return 'search';
            }
        } else {
            return 'search';
        }
    }
    $scope.processForm = function() {
        switch ($scope.urlType()) {
            case 'url':
                $scope.openUrl();
                break;
            case 'search':
                socket.emit('pirateSearch', { query: $scope.url, page: $scope.currentSearchPage });
                $scope.search.loading = true;
                break;
            case 'magnet':
                $scope.addTorrent($scope.url);
        }
    }
    $scope.addTorrent = function(magnetLink) {
        $scope.magnetLoading = true;
        socket.emit('addTorrent', { magnet: magnetLink });
        $timeout(function() {
            if ($scope.magnetLoading) {
                $scope.magnetLoading = false;
                alert("Error loading Magnet.");
            }
        }, 60000);
    }
    $scope.numKeys = function(obj) {
        return Object.keys(obj).length;
    }
    $scope.showTorrentFiles = function(obj) {
        if (obj.showFiles) {
            obj.showFiles = false;
            return false;
        }
        if (obj.dirStructure) {
            //already have dirStructure
            obj.showFiles = true;
        } else {
            //request server for dirStructure
            obj.msg = "Getting directory structure";
            obj.gettingDirStructure = true;
            socket.emit('getDirStructure', { id: obj.id });
        }
    }
    $scope.toggleIncognito = function() {
        $scope.incognito = !$scope.incognito;
        socket.emit("toggleIncognito");
    }
    $scope.getProgress = function(page) {
        if (page.progress == 100 && page.cloudUploadProgress) {
            return page.cloudUploadProgress;
        } else {
            return page.progress;
        }
    }
    $scope.zipAndDownload = function(page) {
        if (page.zipExists) {
            window.location.href = "files/" + page.id + ".zip";
        } else {
            page.zipping = true;
            socket.emit("zip", { id: page.id });
        }
    }
    $scope.uploadZipToCloud = function(page) {
        page.zipping = true;
        var name = prompt("Enter file name");
        socket.emit("uploadZipToCloud", { id: page.id, name: name });
    }
});