import { TokenCode, Lexer } from "../src/Lexer/Lexer"

/*describe("Tokenizer", function () {
    it("should parse a declaration", function () {
        let lexer = new Lexer()

        let rustCode = "\n\
            /// The amount of gas given to complete `vote` call.\n\
            const VOTE_GAS: u64 = 100_000_000_000_000;\n\
            \n\
            /// The amount of gas given to complete internal `on_stake_action` call.\n\
            const ON_STAKE_ACTION_GAS: u64 = 20_000_000_000_000;\n\
            "
        lexer.startFromString(rustCode)

        let tokens: string[] = []
        while (true) {
            let t = lexer.token
            if (!t.isSpace()) tokens.push(t.toString())
            if (t.tokenCode == TokenCode.EOF) break
            lexer.advance()
        }
        assert.deepEqual(tokens,
            ["(BOF)",
                "(COMMENT /// The amount of gas given to complete `vote` call.)",
                "(IDENTIFIER const)", "(IDENTIFIER VOTE_GAS)", "(PUNCTUATION :)", "(IDENTIFIER u64)", "(OPERATOR =)", "(NUMBER 100_000_000_000_000)", "(PUNCTUATION ;)",
                "(COMMENT /// The amount of gas given to complete internal `on_stake_action` call.)",
                "(IDENTIFIER const)", "(IDENTIFIER ON_STAKE_ACTION_GAS)", "(PUNCTUATION :)", "(IDENTIFIER u64)", "(OPERATOR =)", "(NUMBER 20_000_000_000_000)", "(PUNCTUATION ;)",
                "(EOF)"
            ])
    })
})
*/
