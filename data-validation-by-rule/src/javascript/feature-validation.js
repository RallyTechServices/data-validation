Ext.define('Rally.technicalservices.FeatureValidationRules',{
    extend: 'Rally.technicalservices.ValidationRules',

    requiredFields: undefined,
    iterations: [],
    stories: [],
    targetSprint: null,
    featureRiskColors: [],
  //  featureHistoryByOid: null,
    currentRelease: null,
    validCDS: null,
    completedStates: ["Operate","Done"],
    featureRiskNames: ["High Risk", "Moderate Risk"],
    displayColorClassificationMapping: null,

    constructor: function(config){
        Ext.apply(this, config);
        this.requiredFields = ['Release','c_FeatureTargetSprint','c_FeatureDeploymentType','c_CodeDeploymentSchedule','State','DisplayColor','PlannedStartDate','PlannedEndDate'];
        //if (config.historicalFeatureSnapshots){
        //    this.featureHistoryByOid = this.aggregateSnapsByOidForModel(config.historicalFeatureSnapshots);
        //}
    },
    
    ruleFn_missingFieldsFeature: function(r) {
        var missingFields = [];

        _.each(this.requiredFields, function (f) {
            if (!r.get(f)) {
                missingFields.push(r.getField(f).displayName);
            }
        });
        if (missingFields.length === 0) {
            return null;
        }
        return Ext.String.format('Missing fields: {0}', missingFields.join(', '));
    },
    
    ruleFn_stateForTargetSprint: function(r) {
        if ( ! this.targetSprint ) {
            return null;
        }
        var featureDone = false;
        if (r.get('State') && r.get('State').Name){
            featureDone = Ext.Array.contains(this.completedStates, r.get('State').Name);
        }

        if (featureDone){
            return null;
        }
        var featureTargetSprint = r.get('c_FeatureTargetSprint');
        if ( Ext.isEmpty( featureTargetSprint) ) { return null; }
        
        if (featureTargetSprint < this.targetSprint ) {
            return Ext.String.format('Feature is set to TargetSprint ({0}) that is earlier than {1} but is not done',featureTargetSprint, this.targetSprint);
        }
        return null;
    },
    
    ruleFn_stateSynchronization: function(r) {
        /**
         * State == Done,
         * then all user stories should be accepted
         * AND
         * if All user stories == Accepted,
         * State should be Done
         */



        var featureDone = false ,
            storiesAccepted = r.get('AcceptedLeafStoryCount') === r.get('LeafStoryCount');

        if (r.get('State') && r.get('State').Name){
            featureDone = Ext.Array.contains(this.completedStates, r.get('State').Name);
        }

        if (featureDone === storiesAccepted){
            return null;
        }
        if (featureDone){
            return Ext.String.format('Feature is Done but not all stories are accepted ({0} of {1} accepted)', r.get('AcceptedLeafStoryCount'), r.get('LeafStoryCount'));
        }
        return Ext.String.format('Feature state ({0}) should be Done because all stories are accepted.', r.get('State').Name);
    },
    _getFeatureRiskColors: function(){
        var mapping = this.displayColorClassificationMapping || {},
            colors = [],
            risk_names = this.featureRiskNames;
        _.each(mapping, function(name, color){
            if (Ext.Array.contains(risk_names, name)){
                colors.push(color);
            }
        });
        return colors;
    },
    ruleFn_featureIsRisk: function(r){
        if (r.get('DisplayColor')){
            if (Ext.Array.contains(this._getFeatureRiskColors(), r.get('DisplayColor'))){
                return Ext.String.format('<div class="tscolor" style="background-color:{0};"></div>Feature is flagged as a Risk', r.get('DisplayColor'));
            }
        }
        return null;
    },
    //ruleFn_featureTargetSprintPushed: function(r){
    //    var featureHistory = this.featureHistoryByOid[r.get('ObjectID')],
    //        inRelease = false,
    //        startTargetSprint = null,
    //        endTargetSprint = null;
    //
    //    if (featureHistory) {
    //
    //        _.each(featureHistory, function (snap) {
    //            if (!inRelease && snap.Release.Name == this.currentRelease) {
    //                inRelease = true;
    //            }
    //            if (!startTargetSprint && snap['_PreviousValues.c_FeatureTargetSprint'] &&
    //                snap['_PreviousValues.c_FeatureTargetSprint'] != '' &&
    //                snap['_PreviousValues.c_FeatureTargetSprint'] != 'TBD') {
    //                startTargetSprint = snap['_PreviousValues.c_FeatureTargetSprint'];
    //            }
    //
    //            if (snap['c_FeatureTargetSprint']){
    //                endTargetSprint = snap['c_FeatureTargetSprint'];
    //            }
    //        });
    //
    //        if (startTargetSprint &&
    //            startTargetSprint != endTargetSprint) {
    //
    //            return Ext.String.format('Feature Target Sprint pushed from {0} to {1}',
    //                startTargetSprint, endTargetSprint);
    //        }
    //    }
    //    return null;
    //},
    ruleFn_validateCodeDeploymentSchedule: function(r){
        if (!this.validCDS || this.validCDS.length == 0){
            return null;
        }

        var featureDone = false;
        if (r.get('State') && r.get('State').Name){
            featureDone = Ext.Array.contains(this.completedStates, r.get('State').Name);
        }

        if (r.get('c_CodeDeploymentSchedule') && featureDone == false &&
            !Ext.Array.contains(this.validCDS, r.get('c_CodeDeploymentSchedule'))){
            return Ext.String.format('Code Deployment Schedule ({0}) is not a current valid Code Deployment Schedule.', r.get('c_CodeDeploymentSchedule'));
        }
        return null;
    },
//    ruleFn_featureTargetSprintMatchesRelease: function(r){
//        /**
//         * FTS == R4.xxx, then Release should be Release 4
//         *
//         */
//        var fts = r.get('c_FeatureTargetSprint'),
//            release = r.get('Release').Name;
//
//        var matches = release.match(/^Release\s+(\d+)/);
//        if (matches){
//            var re = new RegExp('^R' + matches[1]);
//            if (re.test(fts)){
//                return null;
//            }
//        }
//        return Ext.String.format('Feature Target Sprint ({0}) does not match Release ({1})',fts, release);
//
//    },
    ruleFn_featureHasDoDStories: function(r){



        return null;
    },
    ruleFn_storiesPlannedByFeatureTargetSprint: function(r){
        /**
         * FTS == R4.xxx,
         * then all US.Iteration should be scheduled in or before R4.xxx
         */
        return null;
    },
    ruleFn_featureDisplayColor: function(r){
        /**
         * DisplayColor should be one of the risk associated colors...
         */
        if (r.get('DisplayColor')){
            if (Ext.Array.contains(_.keys(this.displayColorClassificationMapping), r.get('DisplayColor').toLowerCase())){
                return null;
            }
            return Ext.String.format('DisplayColor (<span style="background-color:{0};">{0}</span>) is not a current valid Feature Risk Color.', r.get('DisplayColor'));
        }

        return Ext.String.format('DisplayColor <span style="background-color:{0};">{0}</span> is not set.', r.get('DisplayColor'));
    },
    aggregateSnapsByOidForModel: function(snaps){
        //Return a hash of objects (key=ObjectID) with all snapshots for the object
        var snaps_by_oid = {};
        Ext.each(snaps, function(snap){
            var oid = snap.ObjectID || snap.get('ObjectID');
                if (snaps_by_oid[oid] == undefined){
                    snaps_by_oid[oid] = [];
                }
                snaps_by_oid[oid].push(snap.getData());
        });
        return snaps_by_oid;
    }
});
