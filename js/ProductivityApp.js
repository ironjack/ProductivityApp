Ext.define('ProductivityApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    layout: 'fit',
    
    launch: function() {
    	var currentDate = Ext.Date.getFirstDateOfMonth(new Date());
    	this.endDate = Ext.Date.add(currentDate, Ext.Date.MONTH, -1);
	    this.teamTaskStartDate = Ext.Date.add(currentDate, Ext.Date.MONTH, -6);
		this.rollingAverageStartDate = Ext.Date.add(currentDate, Ext.Date.MONTH, -9);
    	
    	var dataSource = Ext.create('ProductivityDataSource', {
    		teamTaskStartDate: this.teamTaskStartDate,
    		rollingAverageStartDate: this.rollingAverageStartDate,
    		callback: {
    			fn: this._onDataSourceLoad,
    			scope: this
    		},
    		type:'HierarchicalRequirement'
    	});
    	
    	dataSource.load();
    },
    
    _onDataSourceLoad: function(rollingAverageData, teamTaskActualsData, teamStoryCountData, teamAverageData, teamSizes) {    	
    	var categories = [];
    	var data = [];
    	var companyAverageData = [];
    	var teamData = [];
    	
    	var date = this.teamTaskStartDate;
    	while (date.getTime() <= this.endDate.getTime()) {
    		var monthNumber = date.getMonth() + 1;
    		var average = (rollingAverageData['' + this._subtractMonths(date, 3)] + rollingAverageData['' + this._subtractMonths(date, 2)] + rollingAverageData['' + this._subtractMonths(date, 1)]) / 3;
//     		data.push(average * teamStoryCountData['' + monthNumber] / teamTaskActualsData['' + monthNumber]);
			data.push(teamStoryCountData['' + monthNumber] / teamSizes['' + monthNumber]);
// 			console.log(rollingAverageData['' + this._subtractMonths(date, 3)], rollingAverageData['' + this._subtractMonths(date, 2)], rollingAverageData['' + this._subtractMonths(date, 1)]);
//     		console.log(average * teamStoryCountData['' + monthNumber] / teamTaskActualsData['' + monthNumber], average / teamAverageData['' + monthNumber]);  		
    		companyAverageData.push(average);
    		teamData.push(teamAverageData['' + monthNumber] || 0);
//     		console.log(teamTaskActualsData['' + monthNumber], teamAverageData['' + monthNumber] * teamStoryCountData['' + monthNumber]);
    		categories.push(Ext.Date.format(date, 'M'));
    		date = Ext.Date.add(date, Ext.Date.MONTH, 1);
    	}
        
   	  var chartConfig = {
			chart:{
				defaultSeriesType:'column',
				zoomType: 'xy'
			},
			credits:{
				enabled:false
			},
			title:{
				text:''
			},
			subtitle:{
				text:''
			},
			xAxis:{
				categories: categories,
				tickmarkPlacement:'on',
				title:{
					enabled:false
				}
			},
			yAxis:[
				{
					title:{
						text:'Work Products'
					},
					min:0
				},
				{
					title:{
						text:'Story Size (Hours)'
					},
					min:0,
					opposite: true
				}
			],
			tooltip:{
				formatter:function () {
					return '' + this.x + '<br />' + this.series.name + ': ' + this.y;
				}
			},
			plotOptions:{
				column:{
					stacking:null,
					lineColor:'#666666',
					lineWidth:1,
					marker:{
						lineWidth:1,
						lineColor:'#666666'
					}
				}
			},
			series: [{
				name: 'Work Product Count per Person',
				data: data
			}, {
				name: 'Company Average Story Size',
				type: 'spline',
				data: companyAverageData,
				yAxis: 1
			}, {
			    name: 'Team Average Story Size',
			    type: 'spline',
			    data: teamData,
			    yAxis: 1
			}]
		};
		
		this.add({
			xtype: 'highchart',
			chartConfig: chartConfig
		});
    		
    },
    
    _subtractMonths: function(date, months) {
        return Ext.Date.add(date, Ext.Date.MONTH, -months).getMonth() + 1;
	}
});
