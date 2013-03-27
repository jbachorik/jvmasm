generateClass({
    name: "Shoot",
    methods: [
        ctr = {
            name: "<init>",
            exceptions: "java.lang.Exception",
            code: function(g) {
                with(g) {
                    ALOAD(self("java.lang.Object"))
                    INVOKESPECIAL("java.lang.Object", "<init>", null, null)

                    ALOAD(self("Shoot"))
                    INVOKEVIRTUAL("Shoot", "damethod", null, "java.lang.String")

                    RETURN()
                }
            }
        },
        damethod = {
            name: "damethod",
            ret: "java.lang.String",
            code: function(g) {
                with (g) {
                    var l1 = LABEL()
                    var l2 = LABEL()
                    var x = VAR("x", Type.INT_TYPE, null, l1, l2)
                    LABEL(l1)
                        ICONST(10)
                        ISTORE(x)
                        LCONST(24325)
                        ILOAD(x)
                        LDC("Keketi")
                    LABEL(l2)
                    ARETURN()
                }
            }
        }
    ]
});