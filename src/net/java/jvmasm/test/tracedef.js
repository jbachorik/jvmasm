/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

var trigger1 = {
    name: "counting1",
    match_method: {
        class: /com\.toy\..*/,
        signature: "java.lang.String ()"
    },
    collectors: [
        counter = {
            
        },
        timer = {

        }
    ]
}

var trigger2 = {
    name: "invocations",
    match_invocation: {
        class: "java.lang.StringBuilder",
        name: "append",
        match_class: {
            class: /com\.toy\..*/,
        }
    }
}