Ext.define("TSFeatureStoryMisalignment", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    
    layout: { type: 'border' },
    
    items: [
        {xtype:'container',itemId:'selector_box', region: 'north', layout: { type: 'hbox' }},
        {xtype:'container',itemId:'display_box', region: 'center', layout: 'fit'}
    ],

    
    integrationHeaders : {
        name : "TSFeatureStoryMisalignment"
    },
    
    alignmentField: 'Project',
    projects: [],
    
    launch: function() {
        this._addSelectors(this.down('#selector_box'));
        this._updateData();
        
    },
    
    _addSelectors: function(container) {
        container.removeAll();
        
        container.add({xtype:'container',flex:1,itemId:'spacer'});
        
        container.add({
            xtype:'rallybutton',
            itemId:'export_button',
            text: '<span class="icon-export"> </span>',
            disabled: true,
            listeners: {
                scope: this,
                click: function() {
                    this._export();
                }
            }
        });
    },
    
    _updateData: function() {
        this.setLoading("Loading records...");
        
        var me = this;
        Deft.Chain.pipeline([
            this._getProjects,
            this._getStories,
            this._findMisalignedStories,
            this._setValuesEasierToDisplay,
            this._setProjectPaths
        ],this).then({
            scope: this,
            success: function(rows) {
                this._displayGrid(rows);
            },
            failure: function(error_message){
                alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });
    },
    
    _getStories: function() {
        var config = {
            model: 'HierarchicalRequirement',
            filters: [
                {property:'Feature',operator: '!=', value: null},
                {property:'Feature.State.Name',operator: '!=', value: 'Done'}
            ],
            fetch: ['ObjectID','FormattedID','Name','Feature','Parent',this.alignmentField]
        }
        return this._loadWsapiRecords(config);
    },
    
    _getProjects: function() {
        var deferred = Ext.create('Deft.Deferred');
        
        var config = {
            model: 'Project',
            filters: [
                {property:'Children.State',operator: 'contains', value: 'Open'}
            ],
            fetch: ['ObjectID','Name','Parent'],
            limit: 'Infinity'
        }
        
        this._loadWsapiRecords(config).then({
            scope: this,
            success: function(projects) {
                this.projects = projects;
                deferred.resolve();
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },
    
    _findMisalignedStories: function(stories){
        var alignment_field = this.alignmentField;
        
        return Ext.Array.filter(stories, function(story){
            var feature = story.get('Feature');
            
            var feature_field = feature[alignment_field];
            var story_field = story.get(alignment_field);
            
            return ( story_field.Name != feature_field.Name );
        },this);
    },
    
    _setValuesEasierToDisplay: function(rows){
        var alignment_field = this.alignmentField;
        Ext.Array.each(rows, function(row){
            var feature = row.get('Feature');
            
            row.set('__FeatureID', feature.FormattedID);
            row.set('__FeatureName', feature.Name);
            row.set('__FeatureField', feature[alignment_field].Name);
            
        });
        
        return rows;
    },
    
    _setProjectPaths: function(rows) {
        var parents_by_child_oid = this._arrangeProjectsByChild(rows);
        Ext.Array.each(rows, function(row) {
            var story_project = row.get('Project');
            var feature_project = row.get('Feature').Project;
            row.set('__StoryProjectPath', this._getProjectPath(story_project,parents_by_child_oid) );
            row.set('__FeatureProjectPath', this._getProjectPath(feature_project,parents_by_child_oid) );
        },this);
        
        return rows;
    },
    
    _getProjectPath: function(project,parents_by_child_oid) {
        var top = false;
        var project_array = [];
        
        var candidate = project;
        
        while ( !top ) {
            project_array.push(candidate.Name);
            if (! Ext.isEmpty(parents_by_child_oid[candidate.ObjectID])) {
                candidate = parents_by_child_oid[candidate.ObjectID];
            } else {
                top = true;
            }
        }
        
        
        return project_array.reverse().join(' > ');
    },
    
    _arrangeProjectsByChild: function(rows) {
        var parents_by_child_oid = {};
        this.setLoading("Constructing project paths...");
        
        Ext.Array.each(rows,function(row){
            var story_project = row.get('Project');
            var feature_project = row.get('Feature').Project;
            
            if ( !Ext.isEmpty(story_project.Parent) ) {
                parents_by_child_oid[story_project.ObjectID] = story_project.Parent;
            }
            
            if ( !Ext.isEmpty(feature_project.Parent) ) {
                parents_by_child_oid[feature_project.ObjectID] = feature_project.Parent;
            }
        });
        
        Ext.Array.each(this.projects, function(project){
            if ( !Ext.isEmpty(project.get('Parent') ) ) {
                parents_by_child_oid[project.get('ObjectID')] = project.get('Parent');
            }
        });
        
        return parents_by_child_oid;
    },
    
    
    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        
        this.logger.log("Starting load:",config.model);
          
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    
    _displayGrid: function(rows){
        
        console.log('rows:', rows);
        
        var store = Ext.create('Rally.data.custom.Store',{
            data: rows
        });
        
        var linkRenderer = this._renderLinks;
        
        var columns = [
            { dataIndex:'FormattedID', text: 'Story', renderer: linkRenderer, _csvIgnoreRender: true },
            { dataIndex:'Name', text:'Name', flex: 1 },
            { dataIndex:'__StoryProjectPath', text:'Project'},
            { dataIndex:'Feature', text: 'Feature', renderer: linkRenderer, exportRenderer: function(v) { return v.FormattedID; }},
            { dataIndex:'__FeatureName', text: 'Feature Name', flex: 1 },
            { dataIndex:'__FeatureProjectPath', text:'Feature Project'}
        ];
        
        this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            showRowActionsColumn: false,
            enableColumnResize: false,
            enableColumnMove: false,
            columnCfgs: columns
        });
        
        this.down('#export_button').setDisabled(false);
    },
    
    _renderLinks: function(value, meta, record) {
        var item = record;
        var text = value;
        
        if (! Ext.isString(value) ) {
            item = value;
            text = value.FormattedID;
        }
        
        return Ext.String.format(
            "<a target='_blank' href='{0}'>{1}</a>",
            Rally.nav.Manager.getDetailUrl(item),
            text
        );
    },
    
    _export: function(){
        var grid = this.down('rallygrid');
        var me = this;
        
        if ( !grid ) { return; }
        
        this.logger.log('_export',grid);

        var filename = Ext.String.format('task-report.csv');

        this.setLoading("Generating CSV");
        Deft.Chain.sequence([
            function() { return Rally.technicalservices.FileUtilities.getCSVFromGrid(this,grid) } 
        ]).then({
            scope: this,
            success: function(csv){
                if (csv && csv.length > 0){
                    Rally.technicalservices.FileUtilities.saveCSVToFile(csv,filename);
                } else {
                    Rally.ui.notify.Notifier.showWarning({message: 'No data to export'});
                }
                
            }
        }).always(function() { me.setLoading(false); });
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this.launch();
    }
});
