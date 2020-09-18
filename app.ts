import { Lexer } from "./src/Lexer/Lexer"
import { logger } from "./src/util/logger"
import { Parser } from "./src/Parser/Parser"
import { ASTModule } from "./src/Parser/Grammar"
//import { D3Visualization } from "./src/Producer/D3Visualization"
import { AssemblyScriptProducer } from "./src/Producer/AssemblyScriptProducer"
import * as mkPath from "./src/util/mkPath"

function main() {

    try {

        logger.debugEnabled = false

        const parser = new Parser()
        const parsedModule = parser.parseFile('./tests/test1.rs')

        console.log("parsed ok: " + parsedModule.name)

        //D3Visualization.saveForTree(parsedModule, "./data.json")

        mkPath.create("./out")
        AssemblyScriptProducer.produce(parsedModule,"./out/out.ts")

    }
    catch (ex) {
        console.log(ex)
    }
    console.log("END")
}

console.log('Starting')
main()


