Ext.define('ProductivityDataSource', {
	
	constructor: function(config) {
	    Ext.apply(this, config);
	},
	
	load: function() {
	    this._loadProject();
	},
	
	_loadProject: function() {
	    Ext.create('Rally.data.WsapiDataStore', {
			model: 'Project',
			fetch: ['ObjectID'],
			autoLoad: true,
			filters: [
				{
					property: 'Parent',
					operator: '=',
					value: 'null'
				}
			],
			sorters: [
				{
					property: 'CreationDate',
					direction: 'ASC'
				}
			],
			pageSize: 1,
			listeners: {
				load: this._onProjectsLoad,
				scope: this
			}
		});
	},
	
	_onProjectsLoad: function(store, records) {
		this._loadRollingAverageData(records[0].get("ObjectID"));
	},
	
	_loadRollingAverageData: function(projectOID, allResults, start, ETLDate) {
	    var params = {
			fields: '["_ValidFrom", "_ValidTo", "_Type", "ObjectID", "TaskActualTotal"]',
			find: Ext.encode({
                _Type: {$in: ['HierarchicalRequirement', 'Defect']},
                Children: null,
                ScheduleState: {$gte: "Accepted"},
    			"_PreviousValues.ScheduleState": {$lt: "Accepted"},
                _ValidFrom: {
                    $gte: Ext.Date.format(this.rollingAverageStartDate, 'c')
                },
                _ProjectHierarchy: projectOID
            }),
			pagesize: 20000,
			sort: Ext.encode({
				_ValidFrom: 1
			})
		};
	    if(start && ETLDate) {
	        params.start = start;
	        params.ETLDate = ETLDate;
	    }
		var workspaceOid = Rally.environment.getContext().context.scope.workspace.ObjectID;	    
		Ext.Ajax.request({
			url:"https://rally1.rallydev.com/analytics/1.27/" + workspaceOid + "/artifact/snapshot/query.js?" + Ext.Object.toQueryString(params),
			method:"GET",
			success: Ext.Function.bind(this._onRollingAverageQuery, this, [projectOID, allResults], true),
			scope:this
		});
    },
    
	_onRollingAverageQuery: function(xmlhttp, options, projectOID, allResults) {
		var response = Ext.JSON.decode(xmlhttp.responseText);
		var results = response.Results;
		if(!allResults) {
			allResults = [];
		}
		Ext.Array.insert(allResults, allResults.length, results);
		if(response.StartIndex + response.PageSize < response.TotalResultCount) {
			this._loadRollingAverageData(projectOID, allResults, response.StartIndex + response.PageSize, response.ETLDate);
			return;
		}    

		var buckets = this._getBuckets(allResults);
		
        var averageStorySizes = {};
		Ext.Object.each(buckets, function(month, records) {
			var taskActualTotal = 0;
			Ext.Array.forEach(records, function(record) {
				taskActualTotal += record.TaskActualTotal || 0;
			});
			averageStorySizes[month] = taskActualTotal/records.length;
		});
		this.averageStorySizes = averageStorySizes;
		
		this._loadTeamTaskData();
	},
	
	_getBuckets: function(allResults) {
		var uniques = {};
		Ext.Array.forEach(allResults, function(result) {
			uniques[result.ObjectID] = result;
		});
		
		var buckets = {};
		Ext.Object.each(uniques, function(objectID, record) {
			var date = Ext.Date.parse(record._ValidFrom, 'c');
			var month = "" + (date.getMonth() + 1);
			var records = buckets[month];
			if(!records) {
				records = buckets[month] = [];
			}
			records.push(record);
		});
		return buckets;
	},
	
	_loadTeamTaskData: function(allResults, start, ETLDate) {
		var params = {
			fields: '["_ValidFrom", "_ValidTo", "_Type", "ObjectID", "TaskActualTotal", "Owner"]',
			find: Ext.encode({
                _Type: {$in: ['HierarchicalRequirement', 'Defect']},
                Children: null,
                ScheduleState: {$gte: "Accepted"},
    			"_PreviousValues.ScheduleState": {$lt: "Accepted"},
                _ValidFrom: {
                    $gte: Ext.Date.format(this.teamTaskStartDate, 'c')
                },
                _ProjectHierarchy: Rally.environment.getContext().context.scope.project.ObjectID
            }),
			pagesize: 20000,
			sort: Ext.encode({
				_ValidFrom: 1
			})
		};
	    if(start && ETLDate) {
	        params.start = start;
	        params.ETLDate = ETLDate;
	    }
		var workspaceOid = Rally.environment.getContext().context.scope.workspace.ObjectID;	    
		Ext.Ajax.request({
			url:"https://rally1.rallydev.com/analytics/1.27/" + workspaceOid + "/artifact/snapshot/query.js?" + Ext.Object.toQueryString(params),
			method:"GET",
			success: Ext.Function.bind(this._onTeamTaskQuery, this, [allResults], true),
			scope:this
		});
	},
	
	_onTeamTaskQuery: function(xmlhttp, options, allResults) {
		var response = Ext.JSON.decode(xmlhttp.responseText);
		var results = response.Results;
		if(!allResults) {
			allResults = [];
		}
		Ext.Array.insert(allResults, allResults.length, results);
		if(response.StartIndex + response.PageSize < response.TotalResultCount) {
			this._loadRollingAverageData(allResults, response.StartIndex + response.PageSize, response.ETLDate);
			return;
		}    

		var buckets = this._getBuckets(allResults);
		
		var totalTaskActuals = {};
		var storyCounts = {};
		var averageStorySizes = {};
		var teamSizes = {};
		var userOids = [];
		Ext.Object.each(buckets, function(month, records) {
			var taskActualTotal = 0;
			Ext.Array.forEach(records, function(record) {
				taskActualTotal += record.TaskActualTotal || 0;
				if(!Ext.Array.contains(userOids, record.Owner)) {
			        userOids.push(record.Owner);
			    }
			});
			totalTaskActuals[month] = taskActualTotal;
			storyCounts[month] = records.length;
			averageStorySizes[month] = taskActualTotal / records.length;
			teamSizes[month] = userOids.length;
		});
		Ext.callback(this.callback.fn, this.callback.scope, [this.averageStorySizes, totalTaskActuals, storyCounts, averageStorySizes, teamSizes]);
	}
});