#!/usr/bin/env node

// Validate a language plugin json file
// 1. Is it valid JSON?
// 2. Do all expression blocks have types?
// 3. If there is not a UUID, add one
// 4. a plugin has two main keys: name and blocks
// 5. A block has a blocktype, id, script, help, locals, sockets, type
//    blocktype is mandatory and must be one of: 'expression', 'step', 'eventhandler', 'context', 'asset'
//      A context is a type of step and an eventhandler is a type of context
//      An asset is  a type of expression
//    An id is a mandatory UUID, but can be filled in automatically if missing
//    ids must be unique for every block
//    script is mandatory
//    help is optional but highly recommended (warn if missing)
//    locals are optional and only used for steps and their subtypes (not expressions)
//    sockets have their own spec, every block must have at least one socket
//    type is mandatory for expressions (and their subtypes), illegal on other blocks
//
//    Also document the script templates
//
//  TODO: 
//		* Re-enable warnings on missing help

var uuid = require('../scripts/uuid').uuid;
var isUuid = require('../scripts/uuid').isUuid;
var allBlocks = {};

function validateJson(filename, text){
	var isDirty = false;
	var newUuid = null;
	try{
		var obj = JSON.parse(text);
	}catch(e){
		console.error('Could not parse JSON for %s: %s (check for trailing commas)', filename, e.message);
		return false;
	}
	if (typeof obj.name !== 'string'){
		console.error('A plugin must have a name: %s', filename);
		return false;
	}
	if (! Array.isArray(obj.blocks)){
		console.error('A plugin must have an array of blocks: %s', filename);
		return false;
	}
	try{
		obj.blocks.forEach(function(block){
			var newUuid = validateBlock(block);
			if(newUuid){
				isDirty = true;
			}
		});
	}catch(e){
		console.error('Error in %s: %s', filename, e.message);
		return false;
	}
	if (isDirty){
		console.warn('saving %s with autogenerated UUIDs', filename);
		var fs = require('fs');
		fs.writeFileSync(filename, JSON.stringify(obj, null, '    '));
	}
	return true;
}

function validateBlock(block){
	var newUuid = null;
	validateAnyBlock(block);
	if (!(typeof block.id === 'string' && isUuid(block.id))){
		newUuid = uuid();
		block.id = newUuid;
	}
	if (allBlocks[block.id]){
		newUuid = uuid();
		block.id = newUuid;
		console.warn('found block with duplicate id, updating with new id: ' + JSON.stringify(block));
	}
	allBlocks[block.id] = true;
	if (['step', 'context', 'eventhandler'].indexOf(block.blocktype) > -1){
		if (block.locals){
			if (!Array.isArray(block.locals)){
				throw new Error('Block locals must be an array: ' + JSON.stringify(block));
			}
			block.locals.forEach(validateLocal);
		}
	}
	return newUuid;
}

function validateAnyBlock(block){
	// blocktype is a mandatory string, one of ''
	if (['expression', 'step', 'eventhandler', 'context', 'asset'].indexOf(block.blocktype) < 0){
		throw new Error('A block must have a blocktype: ' + JSON.stringify(block));
	}
	if (typeof block.script !== 'string'){
		throw new Error('A block must have a script template: ' + JSON.stringify(block));
	}
	if (typeof block.help !== 'string'){
		//console.warn('A block should have a help string: ' + JSON.stringify(block)); @todo
	}
	if (['step', 'context', 'eventhandler'].indexOf(block.blocktype) < 0){
		validateExpression(block);
	}else{
		validateStep(block);
	}
	if (!Array.isArray(block.sockets)){
		throw new Error('A block has to have an array of sockets: ' + JSON.stringify(block));
	}
	if (block.sockets.length < 1){
		throw new Error('A block has to have at least one socket: ' + JSON.stringify(block));
	}
	block.sockets.forEach(validateSocket);
}

function validateStep(block){
	if (block.type && block.type != "void"){
		throw new Error('Step blocks cannot have a type: ' + JSON.stringify(block));
	}
}

function validateExpression(block){
	if (block.locals){
		throw new Error('Expression blocks cannot have locals: ' + JSON.stringify(block));
	}
	if (typeof block.type !== 'string'){
		throw new Error('Expressions must have a type: ' + JSON.stringify(block));
	}
}

function validateLocal(block){
	// Locals are like regular blocks except they cannot
	// have locals themselves and they cannot have IDs
	validateAnyBlock(block);
	if (block.locals){
		throw new Error('Local blocks cannot have locals: ' + JSON.stringify(block));
	}
	if (block.id !== undefined){
		throw new Error('Local blocks cannot have ids: ' + JSON.stringify(block));
	}
}

function validateSocket(socket){
//    Sockets have name, type, value or block, options
//      name is mandatory and can be the only value
//      type is optional and can be any type used in the language
//      value is optional, but can only be used if there is a type and must match the type
//      options is the name of an option list and is only used if the type is 'choice'
//      if the type is choice, options is mandatory, it is illegal otherwise
//      if the type is choice, and a value is used, it must match one of the values in the choicelist
//      If block is used instead of value, the value is the UUID of a default block to fill the socket with
	if (typeof socket.name !== 'string'){
		throw new Error('Sockets must have a name: ' + JSON.stringify(socket));
	}
	if (socket.type && typeof socket.type !== 'string'){
		throw new Error('Socket type must be a string: ' + JSON.stringify(socket));
	}
	if (socket.value !== undefined){
		if (!socket.type){
			throw new Error('Sockets with value must have a type: ' + JSON.stringify(socket));
		}
		if (socket.block){
			throw new Error('Sockets can not have both value and block: ' + JSON.stringify(socket));
		}
	}
	if (socket.options){
		if (typeof socket.options !== 'string'){
			throw new Error('Socket options must be strings that are named in the language js file: ' + JSON.stringify(socket));
		}
		if (socket.type !== 'choice'){
			throw new Error('Sockets with options must be of type "choice": ' + JSON.stringfy(socket));
		}
	}
}

exports.validateJson = validateJson;
