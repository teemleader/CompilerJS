class ByteFile {
    data = [];
	
	counter = 0;
    resetCounter() {
        this.counter = 0;
    }

    writeByte(byte, times = 1) {
        for (let x = 0; x < times; x++) { 
            this.data.push(byte);
			this.counter++;
        }
    }

    writeHEX(hexString) {
        const hexDigits = hexString.split(" ");
        for (const digit of hexDigits) {
            this.writeByte(parseInt(digit, 16));
        }
    }

    writeString(string) {
        for (let i = 0; i < string.length; i++) {
            this.writeByte(string.charCodeAt(i));
        } 
    }

    writeStringC(cstring) {
        this.writeString(cstring);
        this.writeByte(0);
    }

    // Array can contain only bytes, strings or ints (one in an array)
    writeByteArray(toWrite) {
        for (const [i, v] of toWrite.entries()) {
            if (Number.isInteger(v)) {
                this.writeByte(v);
            } else if (v.charAt) { // if string
                this.writeString(v);
            } else if (v[0] !== undefined && Array.isArray(v[0])) { // pass WORD as array in array [[word]]
                this.writeWord(v[0][0]);
            } else if (Array.isArray(v)) { //pass INTS as array [dword]
                this.writeInt(v[0]);
            }
        }
    }
    writeArray = this.writeByteArray;

    writeWord(wordValue, times = 1) {
        for (let x = 0; x < times; x++) { 
            let word = wordValue;
            for (let i = 0; i < 2; i++) {
                const byte = word & 0xff;
                this.writeByte(byte);
                word = (word-byte) / 256;
            }
        }
    }

    // 4 bytes number
    writeInt(integer, times = 1) {
        for (let x = 0; x < times; x++) { 
            let long = integer;
            for (let i = 0; i < 4; i++) {
                let byte = long & 0xff;
                this.writeByte(byte);
                long = (long-byte) / 256;
            }
        }
    }

    patchInt(position, newInteger) {
        for (let i = 0; i < 4; i++, position++) {
            const byte = newInteger & 0xff;
            this.data[position] = byte;
            newInteger = (newInteger-byte) / 256;
        }
    }

    save(filename) {
        // copy data to byte array
        let byteArray = new Uint8Array(this.data.length);
        for (let i = 0; i < this.data.length; i++) {
            byteArray[i] = this.data[i];
        }

        // create <a> tag and simulate user click
        const blob = new Blob([byteArray], {type: 'application/exe'});
        if (window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveBlob(blob, filename);
        } else {
            let elem = window.document.createElement('a');
            elem.href = window.URL.createObjectURL(blob);
            elem.download = filename;        
            document.body.appendChild(elem);
            elem.click();        
            document.body.removeChild(elem);
        }
    }
}

function InsertMZHeader(z) {
    z.writeByteArray([0x4D, 0x5A, 0x80, 0x00, 0x01, 0x00, 0x00, 0x00, 0x04, 0x00, 0x10, 0x00, 0xFF, 0xFF, 0x00, 0x00]);
    z.writeInt(0x0140);
    z.writeInt(0x00);
    z.writeInt(0x40);
    z.writeInt(0x00, 8);
    z.writeInt(0x80);

    z.writeByteArray([0x0E, 0x1F, 0xBA, 0x0E, 0x00, 0xB4, 0x09, 0xCD, 0x21, 0xB8, 0x01, 0x4c, 0xCD]);
    z.writeString("!This program cannot be run in DOS mode");
    z.writeByteArray([0x2E, 0x0D, 0x0A, "$"]);
    z.writeInt(0x00, 2);
}

// TODO: PATCH SECTION LENGTH USING C LENGTH
function InsertPEHeader(z, c) { 
    // COFF Header
    z.writeInt(0x00004550);
    z.writeHEX("4C 01 02 00 42 99 B4 58 00 00 00 00");
    z.writeHEX("00 00 00 00 E0 00 0F 01 0B 01 01 47 00 02 00 00");
    z.writeHEX("00 02 00 00 00 00 00 00 00 20 00 00 00 20 00 00");
    z.writeHEX("00 10 00 00 00 00 40 00 00 10 00 00 00 02 00 00");
    z.writeHEX("01 00 00 00 00 00 00 00 04 00 00 00 00 00 00 00");
    z.writeHEX("00 30 00 00 00 02 00 00 21 C7 00 00 02 00 00 00");
    z.writeHEX("00 10 00 00 00 10 00 00 00 00 01 00 00 00 00 00");
    z.writeHEX("00 00 00 00 10 00 00 00 00 00 00 00 00 00 00 00");
    z.writeHEX("00 10 00 00 88 00 00 00 00 00 00 00 00 00 00 00");
    z.writeByte(0x00, 16*6)
    z.writeHEX("00 00 00 00 00 00 00 00 2E 69 64 61 74 61 00 00");  // sections
    z.writeHEX("88 00 00 00 00 10 00 00 00 02 00 00 00 02 00 00");
    z.writeHEX("00 00 00 00 00 00 00 00 00 00 00 00 40 00 00 C0");
    z.writeHEX("2E 74 65 78 74 00 00 00");
    z.writeInt(c.length);       // .text virtual size
    z.writeHEX("00 20 00 00");  // .text virtual address
    let alignto = (Math.floor((c.length-1) / 512)+1) * 512;
    z.writeInt(alignto);        // .text raw data size (aligned to 512)
    z.writeHEX("00 04 00 00 00 00 00 00 00 00 00 00");
    z.writeHEX("00 00 00 00");
    z.writeInt(0xE0000020); // .text section flags = MEM_EXECUTE|MEM_READ|MEM_WRITE|CNT_CODE
    z.writeHEX("00 00 00 00 00 00 00 00");
    z.writeByte(0x00, 16*3)
    z.writeHEX("38 10 00 00 00 00 00 00 00 00 00 00 28 10 00 00");  // .idata
    z.writeHEX("48 10 00 00 00 00 00 00 00 00 00 00 00 00 00 00");
    z.writeHEX("00 00 00 00 00 00 00 00 4B 45 52 4E 45 4C 33 32");  // imports
    z.writeHEX("2E 44 4C 4C 00 00 00 00 58 10 00 00 68 10 00 00");
    z.writeHEX("7A 10 00 00 00 00 00 00 58 10 00 00 68 10 00 00");
    z.writeHEX("7A 10 00 00 00 00 00 00 00 00 4C 6F 61 64 4C 69");
    z.writeHEX("62 72 61 72 79 41 00 00 00 00 47 65 74 50 72 6F");
    z.writeHEX("63 41 64 64 72 65 73 73 00 00 00 00 45 78 69 74");
    z.writeHEX("50 72 6F 63 65 73 73 00 00 00 00 00 00 00 00 00");
    z.writeByte(0x00, 16*23)
}

function isCall(ca) {
    let bracket1 = ca.indexOf("(");
    let bracket2 = ca.indexOf(")");
    if ((bracket1 !== -1) && (bracket2 !== -1)) {
        let name = ca.substr(0, bracket1); 
        return (isNameAllowed(name));
    } else {
        return false;
    }
}

const digits = "1234567890";
function isNumber(str) {
    for (let x = 0; x < str.length; x++) {
        if (digits.indexOf(str[x]) === -1) {
            return false;
        }
    }
    return true;
}
const letters = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM";
function isNameAllowed(str) {
    for (let x = 0; x < str.length; x++) {
        if (letters.indexOf(str[x]) === -1 && str[x] !== "_") {
            if (digits.indexOf(str[x]) === -1) {
                return false;
            } else if (x === 0) {
                return false;
            }
        }
    }
    return true;
}

function BreakCall(ca) {
    let bracket1 = ca.indexOf("(");
    let bracket2 = ca.indexOf(")");

    let result = {};

    let befbra = ca.substr(0, bracket1).split(" "); 
    result.name = befbra[befbra.length-1];

    result.args = [];

    let argarr = ca.substring(bracket1+1, bracket2);
    if (argarr.length > 0) {
        argarr = argarr.split(",");
        for (const [i, v] of argarr.entries()) {
            let r = {
                "type": "error",
                "value": 0
            };

            if (v.startsWith('"') && v.endsWith('"')) {
                r["type"] = "string";
                r["value"] = v.substr(1,v.length-2);
            } else if (isNumber(v)) {
                r["type"] = "int";
                r["value"] = parseInt(v);
            } else if (isNameAllowed(v)) {
                r["type"] = "variable";
                r["value"] = v;
            }

            result.args.push(r);
        }
    }

    return result;
}

function BreakFunc(ca) {
    let bracket1 = ca.indexOf("(");
    let bracket2 = ca.indexOf(")");
    let befbra = ca.substr(0, bracket1);

    let result = {};
    result.func = befbra.split(" ")[0];
    result.name = befbra.split(" ")[1];
    result.args = [];

    let argarr = ca.substring(bracket1+1, bracket2).split(",");
    if (argarr[0].length > 0) {
        let curraddr = 8;
        for (const [i, v] of argarr.entries()) {
            let onearg =  v.split(" ");
            let r = {
                    "type": "int",
                    "name": onearg[0],
                    "addr": curraddr
                };

            if (onearg.length == 2) {
                r["type"] = onearg[0];
                r["name"] = onearg[1];
            }
            
            curraddr += 4;
            result.args.push(r);
        }
    }

    return result;
}

function Compiler() {

    function Throw(line, what) {
        alert("ERROR (line "+ line +"): "+ what);
    }    

    var Comp = this; 
    Comp.lines = [];
    Comp.linesdo = [];
    var t = Comp.fil = {};

    Comp.globals = [];
    Comp.globalssize = 0;
    Comp.functions = [];
    Comp.currfunc = -1;
    function addFunc(_name, _args, _result) {
        Comp.functions.push({
            "name": _name,
            "locals": [],
            "args": _args,
            "result": _result,
            "curraddr": -4,
            "closed": false
        });
        Comp.currfunc++;
    }
    function endFunc() {
        Comp.functions[Comp.currfunc].closed = true;
    }
    function inFunc() {
        if (Comp.currfunc > -1) {
            return (!Comp.functions[Comp.currfunc].closed);
        } else {
            return false;
        }
    }
    function getFunc(_name) {
        for (const [i, v] of Comp.functions.entries()) {
            if (v.name === _name) {
                return i;
            }
        }
        return -1;
    }
    function goFunc(_name)  {
        let ff = getFunc(_name);
        if (ff > -1) {
            Comp.currfunc = getFunc(_name);
        }
        /*for (const [i, v] of Comp.functions.entries()) {
            if (v.name === _name) {
                Comp.currfunc = i;
            }
        }*/
    }
    function localsSize() {
        return Math.abs(Comp.functions[Comp.currfunc].curraddr + 4);
        //return Comp.functions[Comp.currfunc].locals.length*4;
    }
    function addGlobal(_name, _type, _value) {
        Comp.globals.push({
            "name": _name,
            "type": _type,
            //"addr": Comp.globalssize,
            "value": _value
        });
        Comp.globalssize += 4;
    }
    function getGlobal(_name) {
        for (const [i, v] of Comp.globals.entries()) {
            if (v.name === _name) {
                return i;
            }
        } return "error";
    }
    function addVarAt(_name, _type, _addr) {
        Comp.functions[Comp.currfunc].locals.push({
            "name": _name,
            "type": _type,
            "addr": _addr
        });
    }
    function addVar(_name, _type) {
        Comp.functions[Comp.currfunc].locals.push({
            "name": _name,
            "type": _type,
            "addr": Comp.functions[Comp.currfunc].curraddr
        });
        Comp.functions[Comp.currfunc].curraddr -= 4;
    }
    function varAddr(_name) {
        if (Comp.currfunc > -1) {
            for (const [i, v] of Comp.functions[Comp.currfunc].locals.entries()) {
                if (v.name === _name) {
                    return v.addr;
                }
            }
        } return "error";
    }
    function varType(_name) { // unused
        for (const [i, v] of Comp.functions[Comp.currfunc].locals.entries()) {
            if (v.name === _name) {
                return v.type;
            }
        } return "error";
    }

    var keywords = ["var", "func"];
    function isKeyword(_key) {
        for (const [i, v] of keywords.entries()) {
            if (_key === v) {
                return true;
            }
        }
        return false;
    }
    function removeWhiteSpaces(_text) {
        let result = "";

        let instring = false;     // actually in "string"?
        let key = "";             // current keyword
        for (let i = 0; i < _text.length; i++) {
            let c = _text[i];

            if (c === " ") {
                if (instring || isKeyword(key)) {  // copy space only if we are in string or previous word was a keyword
                    result += c;
                } 
            } else {
                result += c;                       // if not space then copy
                key += c;                          // store last word
                instring = (c === "\"") ? !instring : instring;
            }
            key = (letters.indexOf(c) === -1) ? "" : key; // if not letter then clear last word

        }
        return result;
    }

    // variable

    Comp.Analize = function(text) {
        t = new ByteFile();

        Comp.lines = text.split("\n");
        for (const [i, v] of Comp.lines.entries()) {
            let cl = removeWhiteSpaces(v);
            let temp = cl.split(" ");
            let willdo = {
                dowhat: "error",
                first: "",
                second: "",
                data: {},
                line: i
            };
    
            if (temp[0]==="var") {
                let equal_ = cl.indexOf("=");
                let left_ = (equal_ !== -1) ? cl.substring(4, equal_) : cl.substr(4);
                if (!isNameAllowed(left_)) {
                    Throw(i, "Variable name \""+left_+"\" is not valid");
                    return false;
                }
                if (varAddr(left_) !== "error" || getGlobal(left_) !== "error") {
                    Throw(i, "Variable \""+ left_ +"\" redefined");
                    return false;
                }
                // variable assign
                if (equal_ !== -1) {
                    let right_ = cl.substr(equal_+1);  
                    if (isCall(right_)) { 
                        // is global   addGlobal
                        if (inFunc()) {
                            addVar(left_, "int");
                            willdo.dowhat = "set var to call";
                            willdo.first = left_;
                            willdo.second = "local";
                            willdo.data = BreakCall(right_);
                        } else {
                            Throw(i, "Can't assign global variable \""+ left_ +"\" outside of a function");
                            return false;
                        }
                    } else {
                        willdo.first = left_;
                        // if in func then "var x = " must mean it's local!
                        if (inFunc()) {
                            addVar(left_, "int");
                            willdo.second = "local";
                            if (isNumber(right_)) {
                                willdo.dowhat = "set var to number";
                                willdo.data = parseInt(right_);
                            } else if (right_.startsWith('"') && right_.endsWith('"')) {
                                willdo.dowhat = "set var to string";
                                willdo.data = right_.substr(1,right_.length-2);
                            } else if (varAddr(right_) !== "error") {
                                willdo.dowhat = "set var to local";
                                willdo.data = right_;
                            } else if (getGlobal(right_) !== "error") {
                                willdo.dowhat = "set var to global";
                                willdo.data = right_;
                            } else {
                                Throw(i, "Can't understand expression after =");
                                return false;
                            }
                        } else {
                            if (isNumber(right_)) {
                                // don't do anything, globals are assigned first anyway
                                addGlobal(left_, "int", parseInt(right_));
                                willdo.dowhat = "nop";
                            } else {
                                Throw(i, "Global variable \""+ left_ +"\" can't be assigned outside of a function");
                                return false;
                            }
                        }
                    }
                // initiate empty variable
                } else {
                    if (inFunc()) {
                        addVar(left_, "int");
                    } else {
                        addGlobal(left_, "int", 0); 
                    }
                }
            // new function
            } else if ((temp[0]==="func") && (isCall(temp[1]))) {
                let fi = BreakFunc(cl);
                if (isNameAllowed(fi.name)) {
                    if (!inFunc()) {
                        addFunc(fi.name, fi.args, fi.result);
                        // add arguments as locals :----D
                        for (const [i, v] of fi.args.entries()) {
                            addVarAt(v.name, "int", v.addr);
                        } // .type .name .addr
                        willdo.dowhat = "start function";
                        willdo.first = fi.name;
                        willdo.data = fi;
                    } else {
                        Throw(i, "Can't start function inside of a function");
                        return false;
                    }
                } else {
                    Throw(i, "Function name \""+temp[1]+"\" is not valid");
                    return false;
                }
            } else if (temp[0]==="endfunc") {
                if (inFunc()) {
                    endFunc();
                    willdo.dowhat = "end function";  
                } else {
                    Throw(i, "No started function to end");
                    return false;
                }
            } else {

                let equal_ = cl.indexOf("=");
                if (equal_ != -1) {
                    let left_ = cl.substr(0, equal_);
                    // existing variable assign
                    if (isNameAllowed(left_)) {
                        if (varAddr(left_) === "error" && getGlobal(left_) === "error") {
                            Throw(i, "Variable \""+ left_ +"\" is not defined");
                            return false;
                        }
                        let right_ = cl.substr(equal_+1);  
                        if (isCall(right_)) { 
                            if (inFunc()) {
                                willdo.dowhat = "set var to call";
                                willdo.first = left_;
                                willdo.second = (getGlobal(left_) === "error") ? "local" : "global";
                                willdo.data = BreakCall(right_);
                            } else {
                                Throw(i, "Can't assign any variable \""+ left_ +"\" outside of a function");
                                return false;
                            }
                        } else {
                            willdo.first = left_;
                            if (inFunc()) {
                                willdo.second = (getGlobal(left_) === "error") ? "local" : "global";
                                if (isNumber(right_)) {
                                    willdo.dowhat = "set var to number";
                                    willdo.data = parseInt(right_);
                                } else if (right_.startsWith('"') && right_.endsWith('"')) {
                                    willdo.dowhat = "set var to string";
                                    willdo.data = right_.substr(1,right_.length-2);
                                } else if (varAddr(right_) !== "error") {
                                    willdo.dowhat = "set var to local";
                                    willdo.data = right_;
                                } else if (getGlobal(right_) !== "error") {
                                    willdo.dowhat = "set var to global";
                                    willdo.data = right_;
                                } else {
                                    Throw(i, "Can't understand expression after =");
                                    return false;
                                }
                            } else {
                                Throw(i, "Variables \""+ left_ +"\" can't be assigned outside of a function");
                                return false;
                            }
                        }
                    }
                }
            }

            Comp.linesdo.push(willdo);
        }

        return true;
    }

    function OPJmpPlus4(howmuch) {
        t.writeArray([0xE9, [howmuch]]);
    }

    function OPCallEAX() {
        t.writeArray([0xFF, 0xD0]);
    }

    function OPCallPlus(howmuch) {
        t.writeArray([0xE8, [howmuch]]);    // call $+howmuch
    }

    function OPCallMinus(howmuch) {
        t.writeArray([0xE8, [(0xFFFFFFFF - (howmuch+5)) + 1]]);    // call $-howmuch
    }

    function OPCallPTR(addr) {
        t.writeArray([0xFF, 0x15, [addr]]); // call dword ptr [addr]
    }

    function OPMovEAX(addr) {
        t.writeArray([0xB8, [addr]]);
    }

    function OPMovECXPTR(value) {
        t.writeArray([0xC7, 0x01, [value]]);
    }

    function LocalHelper(local, byte_callback, dword_callback) {
        if (local < 0) {
            if (local >= -0x80) {
                byte_callback((0xFF-Math.abs(local)) + 1);
            } else {
                dword_callback((0xFFFFFFFF-Math.abs(local)) + 1);
            }
        } else {
            if (local <= 0x7F) {
                byte_callback(local);
            } else {
                dword_callback(local);
            }
        }
    }

    function OPMovLocal(local, value) {
        LocalHelper(local, function(l) {
            t.writeArray([0xC7, 0x45, l, [value]]); 
        }, function (l) {
            t.writeArray([0xC7, 0x85, [l], [value]]);
        });
    }

    function OPMovEAXToLocal(local) {
        LocalHelper(local, function(l) {
            t.writeArray([0x89, 0x45, l]); 
        }, function (l) {
            t.writeArray([0x89, 0x85, [l]]);
        });
    }

    function OPMovECXToLocal(local) {
        LocalHelper(local, function(l) {
            t.writeArray([0x89, 0x4D, l]); 
        }, function (l) {
            t.writeArray([0x89, 0x8D, [l]]);
        });
    }

    function OPMovLocalToECX(local) {
        LocalHelper(local, function(l) {
            t.writeArray([0x8B, 0x4D, l]); 
        }, function (l) {
            t.writeArray([0x8B, 0x8D, [l]]);
        });
    }

    function OPMovLocalToEAX(local) {
        LocalHelper(local, function(l) {
            t.writeArray([0x8B, 0x45, l]); 
        }, function (l) {
            t.writeArray([0x8B, 0x85, [l]]);
        });
    }

    function OPMovEAXToECXPTR() {
        t.writeArray([0x89, 0x01]);   // mov [ecx],eax
    }

    function OPCallECXPTR() {
        t.writeArray([0xFF, 0x11]);   // call [ecx]
    }

    function OPMovECXtoEAXPTR() {
        t.writeArray([0x89, 0x08]);   // mov [eax],ecx 
    }

    function OPGlobalPTRToECX(_global) {
        OPCallPlus(0);                // call $+5
        let diff = t.counter - _global;
        OPPopECX();                   // pop ecx
        OPSubECX(diff);               // sub ecx,diff
    }

    function OPGlobalPTRToEAX(_global) {
        OPCallPlus(0);                // call $+5
        let diff = t.counter - _global;
        OPPopEAX();                   // pop eax
        OPSubEAX(diff);               // sub eax,diff
    }

    function OPPushEAX() {
        t.writeArray([0x50]);               // push dword eax
    }

    function OPPushECX() {
        t.writeArray([0x51]);               // push dword eax
    }

    function OPPushByte(byte) {
        t.writeArray([0x6A, byte]); // push xx
    }

    function OPPushDWORD(dword) {
        t.writeArray([0x68, [dword]]); // push xxxxxxxx
    }

    function OPPopEAX() {
        t.writeArray([0x58]);
    }

    function OPPopECX() {
        t.writeArray([0x59]);
    }

    function OPMovEAXPTRtoEAX() {
        t.writeArray([0x8B, 0x00]); // mov eax, [eax]
    }

    function OPMovECXPTRtoECX() {
        t.writeArray([0x8B, 0x09]); // mov ecx, [ecx]
    }

    function OPSubEAX(minus) {
        if (minus <= 0x7F) {
            t.writeArray([0x83, 0xE8, minus]);        // sub eax, XX
        } else {
            t.writeArray([0x81, 0xE8, [minus]]);      // sub eax, XXXXXXXX
        }
    }

    function OPSubECX(minus) {
        if (minus <= 0x7F) {
            t.writeArray([0x83, 0xE9, minus]);        // sub eax, XX
        } else {
            t.writeArray([0x81, 0xE9, [minus]]);      // sub eax, XXXXXXXX
        }
    }

    function OPSubPTRESP(minus) {
        if (minus <= 0x7F) {
            t.writeArray([0x83, 0x2C, 0x24, minus]);   // sub [esp], XX
        } else {
            t.writeArray([0x81, 0x2C, 0x24, [minus]]); // sub [esp], XXXXXXXX
        }
    }

    var ssUsed = {}; // static strings used
    function OPPushNextString(pchar) {
        if (ssUsed[pchar] !== undefined) {
            // if string already used...
            OPCallPlus(0);              // call $+5
            let diff = t.counter - ssUsed[pchar];
            OPSubPTRESP(diff);          // sub [esp], diff
        } else {
            t.writeArray([0xE8, [pchar.length+1]]);  // push pchar || call $+pchar.length+1
            ssUsed[pchar] = t.counter;
            t.writeStringC(pchar);                   // db pchar, 0
        }
    }

    function OPEnter(args_count) {
        t.writeArray([0xC8, [[args_count]], 0]);  // 0xC8 (WORD)args_count (BYTE)copyesp
    }

    function OPLeave() {
        t.writeArray([0xC9]); // leave
    }

    function OPRet() {
        t.writeArray([0xC3]); // ret
    }

    function _handleResultToVariable(v) {
        if (v.second === "local") {
            let localPos = varAddr(v.first);
            OPMovEAXToLocal(localPos);       // mov [ebp-local],eax
        } else if (v.second === "global") {
            let globalPos = Comp.globals[getGlobal(v.first)].addr;
            OPGlobalPTRToECX(globalPos);
            OPMovEAXToECXPTR();
        }
    }

    function globalsSize() {
        let ret = 0;
        for (const [i, v] of Comp.globals.entries()) {
            // .name .type .addr .value
            //if (v.type==="int") {
                ret+=4;
            //}
        }
        return ret;
    }

    function PushArguments(v) {
        // getGlobal
        // push arguments backward
        if (v.length > 0) {
            for (let carg = v.length-1; carg > -1; carg--) {
                let curr = v[carg];
                if (curr.type === "int") {
                    OPPushDWORD(curr.value);
                } else if (curr.type === "string") {
                    OPPushNextString(curr.value);
                } else if (curr.type === "variable") {
                    let global = getGlobal(curr.value);
                    if (global !== "error") {
                        // add global variable onto the stack
                        let vari = Comp.globals[global].addr;
                        OPGlobalPTRToECX(vari);
                        OPMovECXPTRtoECX();
                        OPPushECX();
                    } else {
                        let local = varAddr(curr.value);
                        if (local !== "error") {
                            OPMovLocalToECX(local);
                            OPPushECX();
                        } else {
                            return "Unknown identifier: \""+curr.value+"\"";
                        }
                    }
                }
            }
        }
        return true;
    }

    Comp.funcAddr = {};
    Comp.funcCallToPatch = [];
    function callPatch(_fname, _line) {
        Comp.funcCallToPatch.push({
            "at": t.counter,
            "to": _fname,
            "line": _line
        });
        OPCallPlus(0);
    }
    
    Comp.GenerateCode = function() {
        let a = Comp.linesdo;
        let pCodeStart = 0x402000;

        let pLoadLibraryA = 0x401048;
        let pGetProcAddress = 0x40104C;
        let pExitProcess = 0x401050;

        t.resetCounter();

        OPJmpPlus4(0);
        let afterfirstjmp = t.counter;
        
        let globals_align = 4-(t.counter % 4);
        t.writeByte(0xCC, globals_align)
        let pGlobalsStart = t.counter;
        for (const [i, v] of Comp.globals.entries()) {
            // .name .type .addr .value
            v["addr"] = t.counter;
            t.writeInt(v.value);
        }
        
        t.patchInt(1, t.counter - afterfirstjmp);
        callPatch("main", "-");
        OPPushByte(0);
        OPCallPTR(pExitProcess);

        for (const [i, v] of a.entries()) {

            if (v.dowhat === "start function") {
                goFunc(v.data.name);
                Comp.funcAddr[v.first] = t.counter;
                OPEnter(localsSize());
            } else if (v.dowhat === "end function") {
                OPLeave();
                OPRet();
            } else if (v.dowhat === "set var to number") {
                
                if (v.second === "local") {
                    let localPos = varAddr(v.first); 
                    OPMovLocal(localPos, v.data);     // mov [ebp-local],XXXXXXXX
                } else if (v.second === "global") {
                    let globalPos = Comp.globals[getGlobal(v.first)].addr;
                    OPGlobalPTRToECX(globalPos);       // mov ecx,global1ptr
                    OPMovECXPTR(v.data);               // mov [ecx],XXXXXXXX
                }

            } else if (v.dowhat === "set var to string") {

                OPPushNextString(v.data);     // call $+str.len    db "str", 0
                OPPopECX();                   // pop ecx
                if (v.second === "local") {
                    let localPos = varAddr(v.first);
                    OPMovECXToLocal(localPos);    // mov [ebp-local],ecx 
                } else if (v.second === "global") {
                    let globalPos = Comp.globals[getGlobal(v.first)].addr;
                    OPGlobalPTRToEAX(globalPos);      // mov eax,global1ptr
                    OPMovECXtoEAXPTR();               // mov [eax],ecx
                }

            } else if (v.dowhat === "set var to local") {

                let localPos2 = varAddr(v.data);
                OPMovLocalToECX(localPos2);           // mov ecx,[ebp-local2]
                if (v.second === "local") {
                    let localPos = varAddr(v.first);
                    OPMovECXToLocal(localPos);        // mov [ebp-local1],ecx
                } else if (v.second === "global") {
                    let globalPos = Comp.globals[getGlobal(v.first)].addr;
                    OPGlobalPTRToEAX(globalPos);      // mov eax,global1ptr
                    OPMovECXtoEAXPTR();               // mov [eax],ecx
                }

            } else if (v.dowhat === "set var to global") {

                let globalPos2 = Comp.globals[getGlobal(v.data)].addr;
                OPGlobalPTRToECX(globalPos2);   // mov ecx,global2ptr
                OPMovECXPTRtoECX();             // mov ecx,[ecx]

                if (v.second === "local") {
                    let localPos = varAddr(v.first);
                    OPMovECXToLocal(localPos);      // mov [ebp-local],ecx 
                } else if (v.second === "global") {
                    let globalPos = Comp.globals[getGlobal(v.first)].addr;
                    OPGlobalPTRToEAX(globalPos);    // mov eax,global1ptr
                    OPMovECXtoEAXPTR();             // mov [eax],ecx
                }

            } else if (v.dowhat === "set var to call") {

                if (v.data.name === "import") {

                    // import function from dll
                    OPPushNextString(v.data.args[0].value);  // push "library.dll"
                    OPCallPTR(pLoadLibraryA);                // call LoadLibraryA
                    OPPushNextString(v.data.args[1].value);  // push "MessageBoxA" etc
                    OPPushEAX();                             // push eax
                    OPCallPTR(pGetProcAddress);              // call GetProcAddress
                    _handleResultToVariable(v);

                } else {
                    
                    if (getFunc(v.data.name) > -1) {

                        // call global function
                        let pusherror = PushArguments(v.data.args);
                        if (pusherror !== true) { // push function arguments
                            Throw(v["line"], pusherror);
                            return -1;
                        }          
                        callPatch(v.data.name, v.data.index);
                        _handleResultToVariable(v);

                    } else if (getGlobal(v.first) !== "error") {

                        let vari = Comp.globals[getGlobal(v.data.name)].addr;
                        let pusherror = PushArguments(v.data.args);
                        if (pusherror !== true) { // push function arguments
                            Throw(v["line"], pusherror);
                            return -1;
                        }          
                        OPGlobalPTRToECX(vari);
                        OPCallECXPTR();
                        _handleResultToVariable(v);

                    } else if (varAddr(v.data.name) !== "error") {

                        // call function pointer in variable
                        let vari = varAddr(v.data.name);
                        let pusherror = PushArguments(v.data.args);
                        if (pusherror !== true) { // push function arguments
                            Throw(v["line"], pusherror);
                            return -1;
                        }           
                        OPMovLocalToEAX(vari);               // mov eax,[ebp-func]
                        OPCallEAX();                         // call dword eax
                        _handleResultToVariable(v);

                    } else {
                        Throw(v["line"], "Function name \""+v.data.name+"\" is not valid");
                        return -1;
                    }

                }
            }
        }

        // patch dynamic function calls
        for (const [i, v] of Comp.funcCallToPatch.entries()) {
            let faddr = Comp.funcAddr[v["to"]];
            if (faddr !== undefined) {
                if (faddr > v["at"]) {
                    // call forward
                    let patched = faddr - (v["at"]+5);
                    t.patchInt(v["at"]+1, patched);
                } else {
                    // call backward
                    let patched = (v["at"]+5) - faddr;
                    t.patchInt(v["at"]+1, 0xFFFFFFFF-patched+1);
                }
            } else {
                Throw(v["line"], "Function \""+v["to"]+"\" not found");
                return -1;
            }
        }

        return t.data;
    }

}

function InsertCode(z, c) {
    z.writeByteArray(c);

    let alignto = (Math.floor((c.length-1) / 512)+1) * 512;
    z.writeByte(0, alignto-c.length); // align page
}

/*
    TODO:
    - dodaj wywoływanie funkcji bez przypisywania zwrotu do zmiennej
    - dodawaj prawidłową date do pe headera
    - dodaj dodawanie itp
    - dodaj proste dzialania w argumentach funkcji np (variable+10) 
    - dodaj wywolywanie funkcji jako argumentu innej funkcji
    - jakies ify
    - jakies goto




    DONE:
    - wrzucanie liczb i cstringów na stos
    - funkcje globalne i ich zmienne lokalne
    - przypisywanie do zmiennej lokalnej/globalnej wywolania: import, funkcji globalnej, pointera na funkcje w innej zmiennej
    - adresy funkcji sa teraz dynamiczne wzgledem $ (call $+-x)
    - odwołanie drugi raz do tego samego statycznego cstringa pushuje adres poprzedniego zamiast wpisywac nowy jeszcze raz do pliku
    - syntax errory
    - zmienne globalne (wyrownane do 4 w pamieci)
    - ustawianie zmiennych lokalnych na numer, char*, inna zmienna lokalna, inna zmienna globalna
    - ustawianie zmiennych globalnych na numer, char*, inna zmienna lokalna, inna zmienna globalna
    - mozna wstawiac zmienne lokalne i globalne jako argumenty funkcji
    - escapowanie bialych znakow
    - funkcja ma juz dostep do swoich argumentow i moze ich uzywac wywolujac inna funkcje
    - zmiennym raz utworzonym mozna juz przypisywac kolejny raz wartosc

*/