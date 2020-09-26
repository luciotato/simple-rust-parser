import * as path from "path"
import * as mkPath from "../lib/util/mkPath.js"
import { copyFileSync, readFileSync } from "fs"
import { logger } from "../lib/util/logger.js"
import { Parser } from "../lib/Parser/Parser.js"
import { AssemblyScriptProducer as Producer} from "../lib/Producer/AssemblyScriptProducer.js"
import { color } from "../lib/util/color.js"

export function testAssemblyScript() {

    console.log("Testing AssemblyScript Transpiler")

    logger.debugEnabled = false

    const outPath = "out"
    mkPath.create(outPath)

    console.log("writing temp files in " +path.join(process.cwd(), outPath))

    //parse
    let parsedModule 
    try {
        const parser = new Parser()
        parsedModule = parser.parseFile('./res/test/staking-pool/src/lib.rs')
    }
    catch (ex) {
        console.log(ex)
        console.log(process.cwd())
        console.log("Error parsing " + parsedModule?.name)
        throw(ex)
    }

    console.log("parsed ok: " + parsedModule?.name)

    const generatedFile= path.join(outPath, "out.js")

    //produce
    try {
        Producer.produce(parsedModule, generatedFile)
    }
    catch (ex) {
        console.log(ex)
        console.log("Error producing " + parsedModule?.name)
        throw (ex)
    }

    const generated = readFileSync(generatedFile)

    const expectedFile = "./res/test/expected/staking-pool.js"
    const expected = readFileSync(expectedFile)

    if (generated.toString()!==expected.toString()){
        console.log(color.red+"FAILED "+color.normal)
        console.log("expected: "+expectedFile)
        console.log("generated: "+generatedFile)
    }
    else {
        console.log("AssemblyScript Transpiler "+color.green+"OK"+color.normal)
       
    }
}

