jvmasm
======

JavaScript JVM symbolic assembler DSL (JDK8 only)

A very simple DSL allowing to create java classes using the symbolic bytecode instructions.

Eg. to create a constructor one would write

<pre><code>
  // load *this* typed as a superclass on stack
  ALOAD(self("java.lang.Object"))
  // invoke the super constructor
  // INVOKESPECIAL(class, methodName, argumentTypeArray, returnType)
  INVOKESPECIAL("java.lang.Object", "<init>", null, null)

  // load *this* typed as this particular class on stack
  ALOAD(self("pkg.MyClass"))
  // invoke an the *finalMethod*
  // INVOKEVIRTUAL(class, methodName, argumentTypeArray, returnType)
  INVOKEVIRTUAL("pkg.MyClass", "finalMethod", null, "java.lang.String")

  RETURN()
</code></pre>

A complete class definition would look like

<pre><code>
var classDef = {
    name: "pkg.MyClass",
    methods: [
        ctr = {
            name: "&lt;init&gt;",
            exceptions: "java.lang.Exception",
            code: function(g) {
                with(g) {
                    ALOAD(self("java.lang.Object"))
                    INVOKESPECIAL("java.lang.Object", "<init>", null, null)

                    ALOAD(self("pkg.MyClass"))
                    INVOKEVIRTUAL("pkg.MyClass", "finalMethod", null, "java.lang.String")

                    RETURN()
                }
            }
        },
        finalMethod = {
            name: "finalMethod",
            access: Opcodes.ACC_PUBLIC + Opcodes.ACC_FINAL,
            ret: "java.lang.String",
            code: function(g) {
                with (g) {
                    // need start and end labels for the var scope
                    var l1 = LABEL()
                    var l2 = LABEL()
                    // declare a variable
                    // VAR(name, type, genericSignature, startLabel, endLabel)
                    var x = VAR("x", Type.INT_TYPE, null, l1, l2)
                    LABEL(l1)
                        // put an integer constant of 10 on stack
                        ICONST(10)
                        // store the stack top value to the *x* variable
                        ISTORE(x)
                        // put a long constant of 24325 on stack
                        LCONST(24325)
                        // load the *x* variable and put it on stack
                        ILOAD(x)
                        // put a string constant on stack
                        LDC("Got it")
                    LABEL(l2)
                    // return the stack top value (a string constant)
                    ARETURN()
                }
            }
        }
    ]
}
</code></pre>

For more information about the JVM assembler checkout the [instruction reference](https://github.com/jbachorik/jvmasm/wiki/JVM-ASM)

In order to get the actual bytecode one would call 
<pre><code>
  generateClass(classDef)
</code></pre>
which returns a java primitive array (*byte[]*) containing the bytecode.
