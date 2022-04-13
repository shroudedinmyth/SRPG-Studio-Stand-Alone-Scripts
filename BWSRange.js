/*--------------------------------------------------------------------------
  
  Implements the range system from Berwick Saga. Most notably the 0-1 range distinction.
  This also includes the different avoid stats for different ranges and weapons and 0-range initiating weapons taking the defeneder's terrain bonuses for avoid acalculations.  
  0-range rerpesents attacks where the attacker goes into the enemies tile to attack at melee. An example would be Myrmidon running up to the enemy to attack with an Iron Sword.
  1-range represnts the attacker staying in their tile and attacking with as ranged attack. An example would be a soldier staying put and throwing a Javelin at an enemy.
  Magic ignores terrain bonuses.
  2+ ranged attacks are doubly affected by tearrin effects to accuracy.
  0-range only weapons can counter 1-range attacks if the wielder has 11+ attack speed. 
  UI is modified to reflect the new mechanics.
  
  Usage:
  Whenever a weapon has a starting range of 1 in the editor, you may specify how it will handle adjacent attacks.
  In order to specify how a weapon handles adjacent attacks, put one of the following in the custom parameters of the weapon. 

  {adjacentRange: 0} 0-range only. Can only attack and counter from 0-range. Like Swords from Berwick Saga. 1-1 weapons are this by default.
  {adjacentRange: 1} 1-range only. Can only attack and counter from 1-range. Like Throwing Spears from Berwick Saga.
  {adjacentRange: 2} 0-1 range. Can counter both 0 and 1 ranges, but initiates attacks from 1-range. Like Crossbows from Berwick Saga.
  {adjacentRange: 3} 0-1 range. Can counter both 0 and 1 ranges, but initiates attacks from 0-range. Like Dragon's Breath from Berwick Saga. 
  
  1-1 weapons are 0-range only by default when the weapon has no adjacentRange custom parameter.
  1-2, 1-3, 1-4, and so on weapons are by default 1-range only weapons when attacking or attacked adjacently. 
  
--------------------------------------------------------------------------*/

(function() {
	
ItemControl.getAdjacentRange = function(weapon) {
	if(weapon != null && weapon !== undefined ){
		if (typeof weapon.custom.adjacentRange === 'number') {
		return weapon.custom.adjacentRange;
	}
	else {
		var startRange = weapon.getStartRange();
		var endRange = weapon.getEndRange();
		if (startRange === 1 && endRange === 1) {
			return 0;
		}
		if(startRange === 1 && endRange > 1) {
			return 1;
		}
		else {
			return null;
		}	
	}
	}
	
};

AbilityCalculator.getCutthroughValue = function() {
		//Set Attack Speed threshold for Cutthrough.
		var cutthroughValue = 11;
		return cutthroughValue;
	};
	
//Ground units with 0-range weapons cannot initaite attacks against Flying units
AttackChecker.canReach = function(unit, targetUnit, weapon){
	var adjacentRange;
	adjacentRange = ItemControl.getAdjacentRange(weapon);
	if(AttackChecker.isFlying(unit)){
		return true;
	}
	else{
		if(!AttackChecker.isFlying(targetUnit)){
			return true;
		}
		else{
			if (adjacentRange !== 0){
				return true;
			}
			else{
				return false;
			}
		}
	}
};

//Disables Attack command if ground unit tries to attack a Flying unit with a 0-range weapon.
AttackChecker.getAttackIndexArray = function(unit, weapon, isSingleCheck) {
	var i, index, x, y, targetUnit;
	var indexArrayNew = [];
	//var indexArray = IndexArray.createIndexArray(unit.getMapX(), unit.getMapY(), weapon);
	var indexArray = IndexArray.createExtendedIndexArray(unit.getMapX(), unit.getMapY(), weapon, unit)
	var count = indexArray.length;
		
	for (i = 0; i < count; i++) {
		index = indexArray[i];
		x = CurrentMap.getX(index);
		y = CurrentMap.getY(index);
		targetUnit = PosChecker.getUnitFromPos(x, y);
		if (targetUnit !== null && unit !== targetUnit) {
			if (FilterControl.isReverseUnitTypeAllowed(unit, targetUnit)) {
				if(AttackChecker.canReach(unit, targetUnit, weapon)){
					indexArrayNew.push(index);
					if (isSingleCheck) {
						return indexArrayNew;
					}
				}
			}
		}
	}
		
	return indexArrayNew;
};

//Grounded enemies will never attack a flying unit with a 0-range weapon 
var alias = AIScorer.Weapon._getTotalScore;
AIScorer.Weapon._getTotalScore = function(unit, combination) {
		if (AttackChecker.canReach(unit, combination.targetUnit, combination.item)){
			return alias.call(this, unit, combination);
		}
		else{
			return -1;				
		}
	};
	
BaseCombinationCollector._setUnitRangeCombination = function(misc, filter, rangeMetrics) {
		var i, j, indexArray, list, targetUnit, targetCount, score, combination, aggregation;
		var unit = misc.unit;
		var filterNew = this._arrangeFilter(unit, filter);
		var listArray = this._getTargetListArray(filterNew, misc);
		var listCount = listArray.length;
		
		if (misc.item !== null && !misc.item.isWeapon()) {
			aggregation = misc.item.getTargetAggregation();
		}
		else if (misc.skill !== null) {
			aggregation = misc.skill.getTargetAggregation();
		}
		else {
			aggregation = null;
		}
		
		for (i = 0; i < listCount; i++) {
			list = listArray[i];
			targetCount = list.getCount();
			for (j = 0; j < targetCount; j++) {
				targetUnit = list.getData(j);
				if (unit === targetUnit) {
					continue;
				}
				
				if (aggregation !== null && !aggregation.isCondition(targetUnit)) {
					continue;
				}
				
				score = this._checkTargetScore(unit, targetUnit);
				if (score < 0) {
					continue;
				}
				
				if(aggregation === null && !(AttackChecker.canReach(unit, targetUnit, misc.item))){
					continue;
				}
				
				// Calculate a series of ranges based on the current position of targetUnit (not myself, but the opponent).
				indexArray = IndexArray.createRangeIndexArray(targetUnit.getMapX(), targetUnit.getMapY(), rangeMetrics);
				
				misc.targetUnit = targetUnit;
				misc.indexArray = indexArray;
				misc.rangeMetrics = rangeMetrics;
				
				// Get an array to store the position to move from a series of ranges.
				misc.costArray = this._createCostArray(misc);
				
				if (misc.costArray.length !== 0) {
					// There is a movable position, so create a combination.
					combination = this._createAndPushCombination(misc);
					combination.plusScore = score;
				}
			}
		}
	};
	
var alias60 = BaseAttackInfoBuilder.createAttackInfo;
BaseAttackInfoBuilder.createAttackInfo = function(attackParam) {
		root.log("alias60");
		var attackinfo60 = alias60.call(this, attackParam);
		var weapon = ItemControl.getEquippedWeapon(attackinfo60.unitSrc);
		if(attackinfo60.isDirectAttack === true && ItemControl.getAdjacentRange(weapon) === 1){
			attackinfo60.isDirectAttack = false;
		}
		return attackinfo60;
	};

AttackChecker.isCounterattack = function(unit, targetUnit) {
		var weapon, attackWeapon, counterWeapon, range, cutthroughValue, indexArray;
		
		
		var movetype;
		movetype = unit.getClass().getClassType().getMoveTypeID();
		root.log(movetype);
		
		if (!Calculator.isCounterattackAllowed(unit, targetUnit)) {
			return false;
		}
		
		weapon = ItemControl.getEquippedWeapon(unit);
		if (weapon !== null && weapon.isOneSide()) {
			// If the attacker is equipped with "One Way" weapon, no counterattack occurs.
			return false;
		}
		
		// Get the equipped weapon of those who is attacked.
		weapon = ItemControl.getEquippedWeapon(targetUnit);
		
		// If no weapon is equipped, cannot counterattack.
		if (weapon === null) {
			return false;
		}
		
		// If "One Way" weapon is equipped, cannot counterattack.
		if (weapon.isOneSide()) {
			return false;
		}
		
		//Checks if units are adjacent to each other.
		range = Math.abs(unit.getMapX() - targetUnit.getMapX()) + Math.abs(unit.getMapY() - targetUnit.getMapY());
		attackWeapon = ItemControl.getEquippedWeapon(unit);
		counterWeapon = ItemControl.getEquippedWeapon(targetUnit);
		counterAgi = AbilityCalculator.getAgility(targetUnit, counterWeapon);
		cutthroughValue = AbilityCalculator.getCutthroughValue();
		attackWeaponAdjacent =  ItemControl.getAdjacentRange(attackWeapon);
		counterWeaponAdjacent = ItemControl.getAdjacentRange(counterWeapon);
		if(range === 1){
			//The only adjacent weapon type 1-range only weapons cannot counter are 0 and 3 type weapons.
			if ((attackWeaponAdjacent === 0 || attackWeaponAdjacent === 3) && counterWeaponAdjacent === 1){
				return false;
			}
			
			//The only adjacent weapon type 0-range only weapons cannot counter are 1 and 2 type weapons.		
			if ((attackWeaponAdjacent === 1 || attackWeaponAdjacent === 2) && (counterWeaponAdjacent === 0 && counterAgi < cutthroughValue && AttackChecker.canReach(targetUnit, unit))){
				return false;
			}
		}
		
		//indexArray = IndexArray.createIndexArray(targetUnit.getMapX(), targetUnit.getMapY(), weapon);
		indexArray = IndexArray.createExtendedIndexArray(targetUnit.getMapX(), targetUnit.getMapY(), weapon, targetUnit);
		
		return IndexArray.findUnit(indexArray, unit);
	};
	
AbilityCalculator.getMagicAvoid = function(unit) {
		var magicAvoid;
		var cls = unit.getClass();
		
		//Magic Avoid is (Spd * 2)
		magicAvoid = RealBonus.getSpd(unit) * 2;
		
		return magicAvoid;
}

AbilityCalculator.getRangeAvoid = function(unit) {
var rangeAvoid, terrain;
		var cls = unit.getClass();
		
		// Range Avoid is (Spd * 2)
		rangeAvoid = RealBonus.getSpd(unit) * 2;
		
		// If class type gains terrain bonus, add the avoid rate of terrain.
		if (cls.getClassType().isTerrainBonusEnabled()) {
			terrain = PosChecker.getTerrainFromPos(unit.getMapX(), unit.getMapY());
			if (terrain !== null) {
				rangeAvoid += (terrain.getAvoid() * 2);
			}
		}
		
		return rangeAvoid;
}

AbilityCalculator.getInvadeAvoid = function(unit, targetUnit) {
		var invadeAvoid, terrain;
		var cls = unit.getClass();
		
		// Invade Avoid is (Spd * 2)
		invadeAvoid = RealBonus.getSpd(unit) * 2;
		
		// If class type gains terrain bonus, add the avoid rate of opponent's terrain.
		if (cls.getClassType().isTerrainBonusEnabled()) {
			terrain = PosChecker.getTerrainFromPos(targetUnit.getMapX(), targetUnit.getMapY());
			if (terrain !== null) {
				invadeAvoid += terrain.getAvoid();
			}
		}
		
		return invadeAvoid;
}	

HitCalculator.calculateAvoid = function(active, passive, weapon, totalStatus) {
		//Checks to see if unit's are adjacent.
		var range = Math.abs(active.getMapX() - passive.getMapX()) + Math.abs(active.getMapY() - passive.getMapY());
		if(range === 1) {
			if (Miscellaneous.isPhysicsBattle(weapon)) {
				var turnType = root.getCurrentSession().getTurnType();
				var unitTurn = passive.getUnitType();
				var adjacentRange = ItemControl.getAdjacentRange(weapon);
				//If 0 or 3 type 0-range unit initiates attack, get terrain bonus from opponent's terrain.
				if (unitTurn === turnType && (adjacentRange === 0 || adjacentRange === 3)) {
					return AbilityCalculator.getInvadeAvoid(passive, active) + CompatibleCalculator.getAvoid(passive, active, ItemControl.getEquippedWeapon(passive)) + SupportCalculator.getAvoid(totalStatus);
				}
				else {
					return AbilityCalculator.getAvoid(passive) + CompatibleCalculator.getAvoid(passive, active, ItemControl.getEquippedWeapon(passive)) + SupportCalculator.getAvoid(totalStatus);
				}					
			}
			else {
				return AbilityCalculator.getMagicAvoid(passive) + CompatibleCalculator.getAvoid(passive, active, ItemControl.getEquippedWeapon(passive)) + SupportCalculator.getAvoid(totalStatus);		
			}
		}
		else {
			return AbilityCalculator.getRangeAvoid(passive) + CompatibleCalculator.getAvoid(passive, active, ItemControl.getEquippedWeapon(passive)) + SupportCalculator.getAvoid(totalStatus);
		}
	}
	
//Modifies weapon window to correctly display 0-range.
ItemSentence.CriticalAndRange._drawRange = function(x, y, item) {
		var startRange = item.getStartRange();
		var endRange = item.getEndRange();
		var textui = root.queryTextUI('default_window');
		var color = textui.getColor();
		var font = textui.getFont();
		var adjacentRange = ItemControl.getAdjacentRange(item);
		
		if (typeof adjacentRange === 'number'){
			if (adjacentRange === 0){
				startRange = 0;
				endRange = 0;
				
			}
		
			if (adjacentRange === 1){
				startRange = 1;
			}
		
			if (adjacentRange === 2 || adjacentRange ===3){
				startRange = 0;
			}
		}
		
		if (startRange === endRange) {
			NumberRenderer.drawRightNumber(x, y, startRange);
		}
		else {
			NumberRenderer.drawRightNumber(x, y, startRange);
			TextRenderer.drawKeywordText(x + 17, y, StringTable.SignWord_WaveDash, -1, color, font);
			NumberRenderer.drawRightNumber(x + 40, y, endRange);
		}
	}
	
//Modifies unit window to add Magic Avoid and Range Vaoid.
UnitSentenceWindow._configureSentence = function(groupArray) {
		groupArray.appendObject(UnitSentence.Power);
		groupArray.appendObject(UnitSentence.Hit);
		groupArray.appendObject(UnitSentence.Critical);
		groupArray.appendObject(UnitSentence.Avoid);
		groupArray.appendObject(UnitSentence.MagicAvoid);
		groupArray.appendObject(UnitSentence.RangeAvoid);
		groupArray.appendObject(UnitSentence.Range);
		if (DataConfig.isItemWeightDisplayable()) {
			groupArray.appendObject(UnitSentence.Agility);
		}
		groupArray.appendObject(UnitSentence.Fusion);
		groupArray.appendObject(UnitSentence.State);
		groupArray.appendObject(UnitSentence.Support);
	}
	
UnitSentence.MagicAvoid = defineObject(BaseUnitSentence,
{
	_value: 0,
	
	setCalculatorValue: function(unit, weapon, totalStatus) {
		this._value = AbilityCalculator.getMagicAvoid(unit) + totalStatus.avoidTotal;
	},
	
	drawUnitSentence: function(x, y, unit, weapon, totalStatus) {
		var value = this._value;
		var isValid = true;
		
		this.drawAbilityText(x, y, 'MAvo', value, isValid);
	}
}
);

UnitSentence.RangeAvoid = defineObject(BaseUnitSentence,
{
	_value: 0,
	
	setCalculatorValue: function(unit, weapon, totalStatus) {
		this._value = AbilityCalculator.getRangeAvoid(unit) + totalStatus.avoidTotal;
	},
	
	drawUnitSentence: function(x, y, unit, weapon, totalStatus) {
		var value = this._value;
		var isValid = true;
		
		this.drawAbilityText(x, y, 'RAvo', value, isValid);
	}
}
);

//Modifies unit window to correctly display 0-range.
UnitSentence.Range = defineObject(BaseUnitSentence,
{
	drawUnitSentence: function(x, y, unit, weapon, totalStatus) {
		var startRange, endRange, adjacentRange;
		var textui = this.getUnitSentenceTextUI();
		var color = textui.getColor();
		var font = textui.getFont();
		var length = -1;
		var colorIndex = 1;
		var alpha = 255;
		
		TextRenderer.drawKeywordText(x, y, root.queryCommand('range_capacity'), length, color, font);
		x += 78;
		
		if (weapon === null) {
			TextRenderer.drawSignText(x - 5, y, StringTable.SignWord_Limitless);
			return;
		}
		
		startRange = weapon.getStartRange();
		endRange = weapon.getEndRange();
		adjacentRange = ItemControl.getAdjacentRange(weapon);
		
		if (typeof adjacentRange === 'number'){
			if (adjacentRange === 0){
				startRange = 0;
				endRange = 0;
			}
		
			if (adjacentRange === 1){
				startRange = 1;
			}
		
			if (weapon.custom.adjacentRange === 2 || adjacentRange === 3){
				startRange = 0;
			}
		}
		
		if (startRange === endRange) {
			NumberRenderer.drawNumberColor(x, y, startRange, colorIndex, alpha);
		}
		else {
			x -= 30;
			NumberRenderer.drawNumberColor(x, y, startRange, colorIndex, alpha);
			TextRenderer.drawKeywordText(x + 17, y, StringTable.SignWord_WaveDash, -1, color, font);
			NumberRenderer.drawNumberColor(x + 40, y, endRange, colorIndex, alpha);
		}
	}
}
);

UnitSentence.Agility = defineObject(BaseUnitSentence,
{
	_value: 0,
	
	setCalculatorValue: function(unit, weapon, totalStatus) {
		if (weapon !== null) {
			this._value = AbilityCalculator.getAgility(unit, weapon);
		}
	},
	
	drawUnitSentence: function(x, y, unit, weapon, totalStatus) {
		var textui = this.getUnitSentenceTextUI();
		var color = textui.getColor();
		var font = textui.getFont();
		var length = -1
		var cutthroughValue = AbilityCalculator.getCutthroughValue();
		var cutthroughSign = '+';
		var signColor = 0x20ff40;
		var colorIndex = 1;
		var alpha = 255;
		var value = 0;
		var isValid = false;
		
		if (weapon !== null) {
			value = this._value;
			isValid = true;
		}
		
		if (value < cutthroughValue) {			
			this.drawAbilityText(x, y, root.queryCommand('agility_capacity'), value, isValid);
		}
		else {
			TextRenderer.drawKeywordText(x, y, root.queryCommand('agility_capacity'), length, color, font);
			x += 78;
			NumberRenderer.drawNumberColor(x, y, value, colorIndex, alpha);
			TextRenderer.drawKeywordText(x + 13, y, cutthroughSign, -1, signColor, font);
		}
			
	}
}
);

})();
	