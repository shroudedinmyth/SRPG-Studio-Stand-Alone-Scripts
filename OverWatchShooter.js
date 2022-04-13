/*
This script aims to replicate the Overwatch skill from Berwick Saga. 

How it works:
A unit with the Overwatch status will automatically attack enemies that move into their range, even though it is the enemy's turn.
If the unit successfully damages the enemy, the enemy movement will stop and their turn will end.

How to use:
Create a state wiuth custom paramter 'BWS_Overwatch' set to true. When a unit has the state, it will attack enmies that move into their range. If you want to replicate Berwick Saga's Overwatch skill as closely as possible,
set Auto-removal condition as "Enter Battle" and set duration to 1. A separate script will be required to more accurate represnt Berwick Saga's auto-removal conditions.

Limitations:
This script is depedent on the SimulateMove.drawUnit function, so if movement is skipped, it will not work properly. Please do not skip enemy turns. Disable it with another script if possible. 

*/

(function() {
	
	//If you want to be able to skip turns, set this to True. By default it set to false because skipping movement causes problems with the script.
	BaseTurnLogoFlowEntry._SkipToggle = false; 

	//This stores the coordinates of the ranges of Overwwatch enemies.
	SimulateMove._overwatchScope = [];
	
	//This stores the unit's position while they are moving.
	SimulateMove._currentPos = {
		x: null,
		y: null
	}
	
	//This stores the movement path the unit took. 
	SimulateMove._movementPathIndexArray = [];

	//Funtion to disable turn skipping through the config
	var alias999 = BaseTurnLogoFlowEntry._isAutoTurnSkip;
	BaseTurnLogoFlowEntry._isAutoTurnSkip= function() {
		if(BaseTurnLogoFlowEntry._SkipToggle === true){
			return alias999.call(this);
		}
		return false;
	}
	
	//Funtion to disable turn skipping through pressing Start button
	var alias1000 = EnemyTurn._isSkipAllowed;
	EnemyTurn._isSkipAllowed = function() {
		if(BaseTurnLogoFlowEntry._SkipToggle === true){
			return alias1000.call(this);
		}
		return false;
	}
	
	var alias100 = SimulateMove.moveUnit;
	SimulateMove.moveUnit = function() {
			var x, y;
			var dx = this._dxSpeedValue;
			var dy = this._dySpeedValue;
			var chipWidth = GraphicsFormat.MAPCHIP_WIDTH;
			var chipHeight = GraphicsFormat.MAPCHIP_HEIGHT;
			if (this._isMoveFinal) {
				return MoveResult.END;
			}
			if (DataConfig.isHighPerformance()) {
				dx /= 2;
				dy /= 2;
			}
			this._controlScroll(dx, dy);
			
			this._xPixel += XPoint[this._unit.getDirection()] * dx;
			this._yPixel += YPoint[this._unit.getDirection()] * dy;
	
			//Checks to see if unit moved into 	Overwatch enemy range
			var inOverwatchScope = IndexArray.findPos(this._overwatchScope,this._currentPos.x, this._currentPos.y);
			if ((this._xPixel % chipWidth) === 0 && (this._yPixel % chipHeight) === 0) {
				this._playMovingSound();
				this._moveCount++;
				if (this._moveCount === this._moveMaxCount && !(inOverwatchScope)) {
					x = Math.floor(this._xPixel / chipWidth);
					y = Math.floor(this._yPixel / chipHeight);
					this._unit.setMapX(x);
					this._unit.setMapY(y); 
					this._endMove(this._unit);
					return MoveResult.END;
				}
				else {
					this._unit.setDirection(this._moveCource[this._moveCount]);
				}
			}
			this._unitCounter.moveUnitCounter();
			return MoveResult.CONTINUE;
		};
		
	var alias11 = PlayerTurn._moveUnitCommand;
	PlayerTurn._moveUnitCommand = function() {
		//This part stops the unit's movements when hit
		var stop = root.getMetaSession().global.stop;
		if (stop!=null && stop) {
				root.getMetaSession().global.stop = null;
				this.changeCycleMode(PlayerTurnMode.MAP)	
				return MoveResult.CONTINUE;
		}
		
		return alias11.call(this);
	};
	
	var alias2 = SimulateMove.drawUnit;
	SimulateMove.drawUnit = function() {
		//If no Overwatch unit present, proceeds with normal movement
		if(this._overwatchScope.length != 0){
			var scope = this._overwatchScope;
			var inOverwatchScope = false;
			var chipWidth = GraphicsFormat.MAPCHIP_WIDTH;
			var chipHeight = GraphicsFormat.MAPCHIP_HEIGHT;
			var x = Math.round(this._xPixel / chipWidth);
			var y = Math.round(this._yPixel / chipHeight);
	
			//Checks to see if unit moved into 	Overwatch enemy range
			if(this._currentPos.x!=null && this._currentPos.y!=null){
				var inOverwatchScope = IndexArray.findPos(this._overwatchScope,this._currentPos.x, this._currentPos.y);
			}
			
			if(inOverwatchScope){
				this._unit.setMapX(this._currentPos.x);
				this._unit.setMapY(this._currentPos.y);
				
				//This the part that sets up the attack
				if(root.getMetaSession().global.tmpPreAttack == null || root.getMetaSession().global.tmpPreAttack == undefined && 
				root.getMetaSession().global.tmpAttackParam == null || root.getMetaSession().global.tmpAttackParam == undefined){
					this._getOverWatchUnit().setInvisible(false);
					var attackParam = this._createAttackParam();
					var preAttack = createObject(PreAttack);
					preAttack.enterPreAttackCycle(attackParam);
					preAttack.drawPreAttackCycle();
					root.getMetaSession().global.tmpPreAttack = preAttack;
					root.getMetaSession().global.tmpAttackParam = attackParam;
					return MoveResult.CONTINUE;
				}
				//If attack is already set up, this continues or ends the attack				
				else{
					var preAttack = root.getMetaSession().global.tmpPreAttack;
					var attackParam = root.getMetaSession().global.tmpAttackParam;
					if (preAttack.movePreAttackCycle() !== MoveResult.CONTINUE) {
						if(attackParam.targetUnit.custom.overwatchHit !== true){
							attackParam.unit.custom.didShoot = true;
							//this._endMove(this._unit);
							delete root.getMetaSession().global.tmpPreAttack;
							delete root.getMetaSession().global.tmpAttackParam;
							this.setUpdatedOverWatchScope(this._unit);
							return MoveResult.CONTINUE;
						}
						else{
							//If there's a unit where the attacked enemy stopped, go back on their movement path untilm a free spot is found, then set them there.
							var posUnit = PosChecker.getUnitFromPos(x, y);
							if(posUnit != null){
								var currentIndex = CurrentMap.getIndex(x, y);
								var checkCourse = this._movementPathIndexArray;
								var courseCount = checkCourse.length;
								while(courseCount--){
									var checkX = CurrentMap.getX(checkCourse[courseCount]);
									var checkY = CurrentMap.getY(checkCourse[courseCount]);
									var posUnit1 = PosChecker.getUnitFromPos(checkX, checkY);
									if(posUnit1 === null){
										this._currentPos.x = checkX;
										this._currentPos.y = checkY;
										this._unit.setMapX(this._currentPos.x);
										this._unit.setMapY(this._currentPos.y)
										break;
									}
								}
							}
							//Custom parameter didShoot set to avoid the unit from attacking repeatedly
							attackParam.unit.custom.didShoot = true;
							delete root.getMetaSession().global.tmpPreAttack;
							delete root.getMetaSession().global.tmpAttackParam;
							this.setUpdatedOverWatchScope(this._unit);
							this._endMove(this._unit);
							root.getMetaSession().global.stop = true;
							this._unit.setWait(true);
							return MoveResult.END;
						}
						
					}
					else{
						root.getMetaSession().global.tmpPreAttack = preAttack;
						root.getMetaSession().global.tmpAttackParam = attackParam;
						preAttack.drawPreAttackCycle();
						return MoveResult.CONTINUE;
					}
					
				}
			
			}
			
			else {
				this._currentPos.x = x;
				this._currentPos.y = y;
				var unitRenderParam = StructureBuilder.buildUnitRenderParam();
				var currentIndex = CurrentMap.getIndex(x, y);
				if (this._movementPathIndexArray.length != 0){
					for (var k = 0; k < this._movementPathIndexArray.length; k++) {
						
						var included = IndexArray.findPos(this._movementPathIndexArray, x, y);
						if (!(included)){
							this._movementPathIndexArray.push(CurrentMap.getIndex(x, y));                
						}
					}
				}
				else{
					this._movementPathIndexArray.push(CurrentMap.getIndex(x, y))
				}
				if (this._isMoveFinal) {
					return;
				}
				
				unitRenderParam.direction = this._unit.getDirection();
				unitRenderParam.animationIndex = this._unitCounter.getAnimationIndexFromUnit(this._unit);
				unitRenderParam.isScroll = true;
				UnitRenderer.drawScrollUnit(this._unit, this._xPixel, this._yPixel, unitRenderParam);
			}
			
			
			
		}
		else{
			alias2.call(this);
		}
	};
	
	SimulateMove.setUpdatedOverWatchScope = function(unit){
		this._overwatchScope = [];
		var filter = FilterControl.getReverseFilter(unit.getUnitType());
		var startingX = unit.getMapX(); 
		var startingY = unit.getMapY();
		var startingIndex = CurrentMap.getIndex(startingX, startingY);
		var list = FilterControl.getAliveListArray(filter);
			var count = list.length;
			//root.log("alive count: " + count);
			for (var i = 0; i < count; i++){
				var aliveUnits = list[i];
				var aliveCount = aliveUnits.getCount();
				for (var l = 0; l < aliveCount; l++){
					var overwatchUnit = aliveUnits.getData(l);
					var stateList = overwatchUnit.getTurnStateList();
					var stateCount = stateList.getCount();
					for(var j = 0; j < stateCount; j++){
						var state = stateList.getData(j).getState();
						if(state === StateControl.getOverwatchState() && overwatchUnit.custom.didShoot != true){
							var x1 = overwatchUnit.getMapX();
							var y1 = overwatchUnit.getMapY();
							var weapon = ItemControl.getEquippedWeapon(overwatchUnit);
							var indexRange = IndexArray.createIndexArray(x1,y1,weapon);
							for (var k = 0; k < indexRange.length; k++) {
								var index = indexRange[k]
								x1 = CurrentMap.getX(index);
								y1 = CurrentMap.getY(index);
								var included = IndexArray.findPos(this._overwatchScope, x1, y1);
								if (!(included)){
									this._overwatchScope.push(CurrentMap.getIndex(x1, y1));                
								}
							}
						}
					}
				}
			}
	};
	
	SimulateMove.setStartingOverWatchScope = function(unit){
		this._overwatchScope = [];
		var filter = FilterControl.getReverseFilter(unit.getUnitType());
		var startingX = unit.getMapX(); 
		var startingY = unit.getMapY();
		var startingIndex = CurrentMap.getIndex(startingX, startingY);
		var list = FilterControl.getAliveListArray(filter);
			var count = list.length;
			//root.log("alive count: " + count);
			for (var i = 0; i < count; i++){
				var aliveUnits = list[i];
				var aliveCount = aliveUnits.getCount();
				for (var l = 0; l < aliveCount; l++){
					var overwatchUnit = aliveUnits.getData(l);
					delete overwatchUnit.custom.didShoot;
					var stateList = overwatchUnit.getTurnStateList();
					var stateCount = stateList.getCount();
					for(var j = 0; j < stateCount; j++){
						var state = stateList.getData(j).getState();
						if(state === StateControl.getOverwatchState() && overwatchUnit.custom.didShoot != true){
							var x1 = overwatchUnit.getMapX();
							var y1 = overwatchUnit.getMapY();
							var weapon = ItemControl.getEquippedWeapon(overwatchUnit);
							var indexRange = IndexArray.createIndexArray(x1,y1,weapon);
							for (var k = 0; k < indexRange.length; k++) {
								var index = indexRange[k]
								x1 = CurrentMap.getX(index);
								y1 = CurrentMap.getY(index);
								var included = IndexArray.findPos(this._overwatchScope, x1, y1);
								if (!(included) && index != startingIndex){
									this._overwatchScope.push(CurrentMap.getIndex(x1, y1));                
								}
							}
						}
					}
				}
			}
	};
	
	SimulateMove.deleteOverwatchParameters = function(){
		var list = [];
		list.push(PlayerList.getSortieList());
		list.push(EnemyList.getAliveList());
		list.push(AllyList.getAliveList());
		
			var count = list.length;
			//root.log("alive count: " + count);
			for (var i = 0; i < count; i++){
				var aliveUnits = list[i];
				var aliveCount = aliveUnits.getCount();
				for (var l = 0; l < aliveCount; l++){
					var overwatchUnit = aliveUnits.getData(l);
					delete overwatchUnit.custom.didShoot;
					delete overwatchUnit.custom.overwatchMove;
					delete overwatchUnit.custom.overwatchHit
				}
				
			}
	};
	
	var alias3 = SimulateMove.createCource;
	SimulateMove.createCource = function(unit, x, y, simulator) {
			this._currentPos.x = null;
			this._currentPos.y = null;
			this.deleteOverwatchParameters();
			this.setStartingOverWatchScope(unit);
			
			return alias3.call(this, unit, x, y, simulator);
		};
		
	SimulateMove._createAttackParam = function() {
			var attackParam = StructureBuilder.buildAttackParam();		
			attackParam.targetUnit = this._unit;
			attackParam.unit = this._getOverWatchUnit();
			attackParam.attackStartType = AttackStartType.NORMAL;
			
			return attackParam;
		};
		
	SimulateMove._getOverWatchUnit = function(){
		var filter = FilterControl.getReverseFilter(this._unit.getUnitType());
		var list = FilterControl.getAliveListArray(filter);
		var count = list.length;
		for (var i = 0; i < count; i++){
			var aliveUnits = list[i];
			var aliveCount = aliveUnits.getCount();
			for (var k = 0; k < aliveCount; k++){
				var overwatchUnit = aliveUnits.getData(k);
				var stateList = overwatchUnit.getTurnStateList();
				var stateCount = stateList.getCount();
				for(var j = 0; j < stateCount; j++){
					var state = stateList.getData(j).getState();
					if(StateControl.getOverwatchState()){
						var x1 = overwatchUnit.getMapX();
						var y1 = overwatchUnit.getMapY();
						var weapon = ItemControl.getEquippedWeapon(overwatchUnit);
						var indexRange = IndexArray.createIndexArray(x1,y1,weapon);
						if(IndexArray.findPos(indexRange, this._currentPos.x, this._currentPos.y) && overwatchUnit.custom.didShoot != true){
						return overwatchUnit;
						}
					}
				}
			}
		}
		return null;
	};
	
	var alias30 = SimulateMove.moveUnit;
	SimulateMove.moveUnit = function() {
		if(root.getMetaSession().global.tmpPreAttack != null){
			return MoveResult.CONTINUE;
		}
			return alias30.call(this);
		};
		
	var alias70 = MoveAutoAction.setAutoActionInfo; 	
	MoveAutoAction.setAutoActionInfo = function(unit, combination) {
			alias70.call(this, unit, combination);
			this._simulateMove.setStartingOverWatchScope(unit);
		};
		
	var alias80 = AttackFlow._doAttackAction;
	AttackFlow._doAttackAction = function() {
			var order = this._order;
			var active = order.getActiveUnit();
			var passive = order.getPassiveUnit();
			
			var activeStateList = active.getTurnStateList();
			var activeStateCount = activeStateList.getCount();
			for(var j = 0; j < activeStateCount; j++){
				var state = activeStateList.getData(j).getState();
				if(state === StateControl.getOverwatchState() && order.getPassiveDamage() > 0){
					passive.custom.overwatchHit = true;
				}
				if(state === StateControl.getOverwatchState()){
					passive.custom.overwatchMove = true;
				}
			}
			
			var passiveStateList = passive.getTurnStateList();
			var passiveStateCount = passiveStateList.getCount();
			for(var j = 0; j < passiveStateCount; j++){
				var state = passiveStateList.getData(j).getState();
				if(state === StateControl.getOverwatchState() && order.getActiveDamage() > 0){
					active.custom.overwatchHit = true;
				}
				if(state === StateControl.getOverwatchState()){
					active.custom.overwatchMove = true;
				}
			}
			alias80.call(this);
		};
	
	var	alias90 = WeaponAutoAction.enterAutoAction;
	WeaponAutoAction.enterAutoAction = function() {
			var unit = this._unit;
			if (unit.custom.overwatchHit === true){
				return EnterResult.NOTENTER
			}
			return alias90.call(this);
		};
	
	MapSequenceCommand._moveCommand = function() {
			var result;
			
			if (this._unitCommandManager.moveListCommandManager() !== MoveResult.CONTINUE) {
				result = this._doLastAction();
				if (result === 0) {
					this._straightFlow.enterStraightFlow();
					this.changeCycleMode(MapSequenceCommandMode.FLOW);
				}
				else if (result === 1) {
					return MapSequenceCommandResult.COMPLETE;
				}
				else {
					if(this._targetUnit.custom.overwatchMove === true){
						return MapSequenceAreaResult.COMPLETE;
					}
					this._targetUnit.setMostResentMov(0);
					return MapSequenceCommandResult.CANCEL;
				}
			}
	};
	
	
	MapSequenceCommand._doLastAction = function() {
		
			var i;
			var unit = null;
			var list = PlayerList.getSortieList();
			var count = list.getCount();
			
			// Check it because the unit may not exist by executing a command.
			for (i = 0; i < count; i++) {
				if (this._targetUnit === list.getData(i)) {
					unit = this._targetUnit;
					break;
				}
			}
			
			// Check if the unit doesn't die and still exists.
			if (unit !== null) {
				if (this._unitCommandManager.getExitCommand() !== null || this._targetUnit.custom.overwatchMove === true) {
					if (!this._unitCommandManager.isRepeatMovable()) {
						// If move again is not allowed, don't move again.
						this._targetUnit.setMostResentMov(ParamBonus.getMov(this._targetUnit));
					}
					
					// Set the wait state because the unit did some action.
					this._parentTurnObject.recordPlayerAction(true);
					return 0;
				}
				else {
					// Get the position and cursor back because the unit didn't act.
					this._parentTurnObject.setPosValue(unit);
				}
				
				// Face forward.
				unit.setDirection(DirectionType.NULL);
			}
			else {
				this._parentTurnObject.recordPlayerAction(true);
				return 1;
			}
			
			return 2;
		};
	
		StateControl.getOverwatchState = function(){
			var stateList = root.getBaseData().getStateList();
			var stateCount = stateList.getCount();
			for (var i = 0; i < stateCount; i++){
				var state = stateList.getData(i);
				if(state.custom.BWS_Overwatch === true){
					return state;
				}
			}
		}
	
	})();