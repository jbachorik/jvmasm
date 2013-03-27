var writer;

// Global reference to statically imported types
var Opcodes = Packages.jdk.internal.org.objectweb.asm.Opcodes;
var Type = Packages.jdk.internal.org.objectweb.asm.Type;
var ClassWriter = Packages.jdk.internal.org.objectweb.asm.ClassWriter;

var OBJECT_INSTANCE = Type.getObjectType("java/lang/Object");
var OBJECT_TYPE = Type.getType("java/lang/Object");

function Stack() {
    var stack = 0;
    var typeStack = new Array();

    this.push = function (type) {
        if (!(type instanceof Array)) {
            type = [type];
        }
        for(var i in type) {
            typeStack.push(type[i]);
            stack += type[i].size;
        }
    };

    this.pop = function (depth, use_size) {
        if (depth === undefined) {
            depth = 1;
        }
        var ret = new Array();
        var size = 0;
        for(var i=0;i<depth;i++) {
            var type = typeStack.pop();
            if (type === undefined) {
                throw new IllegalArgumentException();
            }
            ret.push(type);
            stack -= type.size;
            size += type.size;
            if (use_size === true && size >= depth) {
                if (size > depth) {
                    throw new IllegalArgumentException();
                }
                break;
            }
        }
        return ret.reverse();
    };

    this.peek = function (depth, use_size) {
        if (depth === undefined) {
            depth = 1;
        }

        var ret = new Array();
        var size = 0;
        for(var i=0;i<depth;i++) {
            ret[i] = typeStack[depth - i - 1];
            size += ret[i].size;
            if (use_size === true && size >= depth) {
                break;
            }
        }

        return ret.reverse();
    };

    this.matches = function () {
        println(arguments.length);
    };

    this.isEmpty = function() {
        return typeStack.lenght === 0;
    };

    this.toString = function() {
        var s = "Stack size = " + stack + "\n";
        var p = 0;
        for(var i in typeStack) {
            s += p + ": " + typeStack[i] + "\n";
            p += typeStack[i].size;
        }
        return s;
    };
}

function IllegalArgumentException(msg) {
    name: "IllegalArgumentException";
    message: msg;
}

function generateClass(classDef) {
    var clzDef = prepareClass(classDef);
    var writer = new ClassWriter(ClassWriter.COMPUTE_FRAMES + ClassWriter.COMPUTE_MAXS);

    clzDef.generate(writer);

    return writer.toByteArray();
}

function prepareClass(classDef) {
    if (classDef === undefined || classDef === null) {
        throw new IllegalArgumentException();
    }

    if (classDef.name === undefined || classDef.name === null) {
        throw new IllegalArgumentException();
    }
    if (classDef.methods === undefined || classDef.methods === null || !(classDef.methods instanceof Array)) {
        throw new IllegalArgumentException();
    }
    
    if (classDef.access === null || classDef.superclass === null || classDef.interfaces === null) {
        throw new IllegalArgumentException();
    }

    var clz = new ClassDef(
        classDef.name,
        classDef.access !== undefined ? classDef.access : Opcodes.ACC_PUBLIC,
        classDef.sig !== undefined ? classDef.sig : null,
        classDef.superclass !== undefined ? classDef.superclass : OBJECT_TYPE,
        classDef.interfaces !== undefined ? classDef.interfaces : null
    );

    for(var m in classDef.methods) {
        var method = classDef.methods[m];
        clz.addMethod(prepareMethod(method));
    }

    return clz;
}

function prepareMethod(methodDef) {
    if (methodDef === undefined || methodDef === null) {
        throw new IllegalArgumentException();
    }

    if (methodDef.name === undefined || methodDef.name === null) {
        throw new IllegalArgumentException();
    }
    if (methodDef.code === undefined || methodDef.code === null) {
        throw new IllegalArgumentException();
    }
    if (methodDef.access === null || methodDef.args === null || methodDef.ret === null || methodDef.exceptions === null) {
        throw new IllegalArgumentException();
    }

    if (methodDef.exceptions !== undefined && !(methodDef.exceptions instanceof Array)) {
        methodDef.exceptions = new Array(methodDef.exceptions);
    }

    return new MethodDef(
        methodDef.name,
        methodDef.access !== undefined ? methodDef.access : Opcodes.ACC_PUBLIC,
        methodDef.args !== undefined ? methodDef.args : new Array(),
        methodDef.ret !== undefined ? methodDef.ret : Type.VOID_TYPE,
        methodDef.exceptions !== undefined ? methodDef.exceptions : null,
        methodDef.code
    );
}

function ClassDef(name, access, sig, superclass, interfaces) {
    var methods = new Array();

    this.addMethod= function(method) {
        methods.push(method);
    }

    this.generate = function(writer) {
        if (writer === null ||
            writer === undefined ||
            name === null ||
            name === undefined)
        {
            throw new IllegalArgumentException();
        }

        writer.visit(
            Opcodes.V1_7,
            access,
            name,
            sig,
            getType(superclass).internalName,
            toJavaArray(
                interfaces,
                Packages.java.lang.String,
                function(it) {
                    return getType(it).internalName;
                }
            )
        );
        
        for(var m in methods) {
            methods[m].generate(writer);
        }
        
        writer.visitEnd();
    }
}

function MethodDef(name, access, args, ret, exceptions, code) {
    this.generate = function(writer) {
        var mv = writer.visitMethod(
            access,
            name,
            Type.getMethodDescriptor(
                getType(ret, true),
                toJavaArray(
                    args,
                    Type,
                    function(it){
                        return getType(it, true).internalName;
                    }
                )
            ),
            null,
            toJavaArray(
                exceptions,
                Packages.java.lang.String,
                function(it) {
                    return getType(it, true).internalName;
                }
            )
        );

        mv.visitCode();

        code(new Generator(mv, access));

        mv.visitMaxs(0, 0);
        mv.visitEnd();
    }
}

function Generator(mv, access) {
    var stack = new Stack();
    var varCounter =  isStatic() ? 0 : 1;

    function isStatic() {
        return (access & Opcodes.ACC_STATIC) !== 0;
    }

    this.self = function(type, sig) {
        return isStatic() ? undefined : new Variable("this", type, sig, 0);
    };

    this.ILOAD = function(v) {
        if (v.type === undefined ||
            v.type !== Type.INT_TYPE)
        {
            throw new IllegalArgumentException()
        }
        stackOp([], Type.INT_TYPE, function() {
            mv.visitVarInsn(Opcodes.ILOAD, v.idx);
        });
    }

    this.LLOAD = function(v) {
        if (v.type === undefined ||
            v.type !== Type.LONG_TYPE)
        {
            throw new IllegalArgumentException()
        }
        stackOp([], Type.LONG_TYPE, function() {
            mv.visitVarInsn(Opcodes.LLOAD, v.idx);
        });
    }

    this.FLOAD = function(v) {
        if (v.type === undefined ||
            v.type !== Type.FLOAT_TYPE)
        {
            throw new IllegalArgumentException()
        }
        stackOp([], Type.FLOAT_TYPE, function() {
            mv.visitVarInsn(Opcodes.FLOAD, v.idx);
        });
    }

    this.DLOAD = function(v) {
        if (v.type === undefined ||
            v.type !== Type.DOUBLE_TYPE)
        {
            throw new IllegalArgumentException()
        }
        stackOp([], Type.DOUBLE_TYPE, function() {
            mv.visitVarInsn(Opcodes.DLOAD, v.idx);
        });
    }

    this.ALOAD = function(v) {
        stackOp([], v.type, function() {
            mv.visitVarInsn(Opcodes.ALOAD, v.idx);
        });
    }

    this.ISTORE = function(v) {
        if (v.type === undefined ||
            v.type !== Type.INT_TYPE)
        {
            throw new IllegalArgumentException()
        }
        stackOp([Type.INT_TYPE], null, function() {
            mv.visitVarInsn(Opcodes.ISTORE, v.idx);
        });
    }

    this.LSTORE = function(v) {
        if (v.type === undefined ||
            v.type !== Type.LONG_TYPE)
        {
            throw new IllegalArgumentException()
        }
        stackOp([Type.LONG_TYPE], null, function() {
            mv.visitVarInsn(Opcodes.LSTORE, v.idx);
        });
    }

    this.FSTORE = function(v) {
        if (v.type === undefined ||
            v.type !== Type.FLOAT_TYPE)
        {
            throw new IllegalArgumentException()
        }
        stackOp([Type.FLOAT_TYPE], null, function() {
            mv.visitVarInsn(Opcodes.FSTORE, v.idx);
        });
    }

    this.DSTORE = function(v) {
        if (v.type === undefined ||
            v.type !== Type.DOUBLE_TYPE)
        {
            throw new IllegalArgumentException()
        }
        stackOp([Type.DOUBLE_TYPE], null, function() {
            mv.visitVarInsn(Opcodes.DSTORE, v.idx);
        });
    }

    this.ASTORE = function(v) {
        stackOp([v.type], null, function() {
            mv.visitVarInsn(Opcodes.ASTORE, v.idx);
        });
    }

    this.IINC = function(v, inc) {
        if (v.type === undefined ||
            v.type !== Type.INT_TYPE ||
            v.type !== Type.LONG_TYPE)
        {
            throw new IllegalArgumentException();
        }
        mv.visitIincInsn(v.idx, inc);
    }

    this.POP = function() {
        mv.visitInsn(Opcodes.POP);
        var val = stack.peek();
        if (val.size === 1) {
            stack.pop();
        } else {
            throw new IllegalArgumentException();
        }
    }

    this.POP2 = function() {
        mv.visitInsn(Opcodes.POP2);

        var val = stack.peek(2, true);

        for(var i=0;i<val.length;i++) {
            stack.pop();
        }
    }

    this.DUP = function() {
        mv.visitInsn(Opcodes.DUP);
        stack.push(stack.peek());

        println(stack);
    }

    this.DUP2 = function() {
        mv.visitInsn(Opcodes.DUP2);
        var vals = stack.peek(2);
        if (vals[1].size === 2) {
            stack.push(vals[1]);
        } else {
            stack.push(vals);
        }

        println(stack);
    }

    this.SWAP = function() {
        mv.visitInsn(Opcodes.SWAP);
        stack.push(stack.pop(2).reverse());

        println(stack);
    }

    this.DUP_X1 = function() {
        mv.visitInsn(Opcodes.DUP_X1);

        var vals = stack.pop(2);
        stack.push(vals[1]);
        stack.push(vals);

        println(stack);
    }

    this.DUP_X2 = function() {
        mv.visitInsn(Opcodes.DUP_X2);

        var vals = stack.pop(3, true);
        stack.push(vals[vals.length - 1]);
        stack.push(vals);

        println(stack);
    }

    this.DUP2_X1 = function() {
        mv.visitInsn(Opcodes.DUP2_X1);

        var vals = stack.pop(3, true);
        var size = 0;

        var index = vals.length - 1;
        if (vals[index].size === 2) {
            stack.push(vals[index]);
        } else if (vals[index - 1].size === 1) {
            stack.push(vals[index - 1]);
            stack.push(vals[index]);
        } else {
            throw new IllegalArgumentException();
        }

        stack.push(vals);

        println(stack);
    }

    this.DUP2_X2 = function() {
        mv.visitInsn(Opcodes.DUP2_X2);

        var vals = stack.pop(4, true);

        var index = vals.length - 1;
        if (vals[index].size === 2) {
            stack.push(vals[index]);
        } else if (vals[index - 1].size === 1) {
            stack.push(vals[index - 1]);
            stack.push(vals[index]);
        } else {
            throw new IllegalArgumentException();
        }

        stack.push(vals);

        println(stack);
    }

    this.ICONST = function(n) {
        if (n < -1 || n > 5) {
            if (n >= -128 && n < 127) {
                mv.visitIntInsn(Opcodes.BIPUSH, n);
                stack.push(Type.BYTE_TYPE);
            } else if (n >= -32768 && n < 32767) {
                mv.visitIntInsn(Opcodes.SIPUSH, n);
                stack.push(Type.SHORT_TYPE);
            } else {
                mv.visitLdcInsn(asInteger(n));
                stack.push(Type.INT_TYPE);
            }
        } else {
            var opcode;
            if (n < 0) {
                opcode = Opcodes.ICONST_M1;
            } else {
                opcode = eval("Opcodes.ICONST_" + n);
            }
            stack.push(Type.BYTE_TYPE);

            mv.visitInsn(opcode);
        }

        println(stack);
    }

    this.LCONST = function(n) {
        stackOp(null, Type.LONG_TYPE, function() {
            if (0 <= n && 1>= n) {
                mv.visitInsn(eval("Opcodes.LCONST_" + n));
            } else {
                mv.visitLdcInsn(asLong(n));
            }
        });
    }

    this.FCONST = function(n) {
        stackOp(null, Type.FLOAT_TYPE, function() {
            if (0 <= n && 2>= n) {
                mv.visitInsn(eval("Opcodes.FCONST_" + n));
            } else {
                mv.visitLdcInsn(asFloat(n));
            }
        });
    }

    this.DCONST = function(n) {
        stackOp(null, Type.DOUBLE_TYPE, function() {
            if (0 <= n && 1>= n) {
                mv.visitInsn(eval("Opcodes.DCONST_" + n));
            } else {
                mv.visitLdcInsn(asDouble(n));
            }
        });
    }

    this.LDC = function(cst) {
        var type;
        if (typeof(cst) === "number") {
            type = Type.DOUBLE_TYPE;
        } else if (typeof(cst) === "string") {
            type = Type.getObjectType("java/lang/String");
        } else if (cst instanceof Type) {
            type = cst;
        } else {
            throw new IllegalArgumentException();
        }

        stackOp(null, type, function() {
            mv.visitLdcInsn(cst);
        });
    }

    this.ACONST_NULL = function() {
        stackOp(null, OBJECT_INSTANCE, function(){
            mv.visitInsn(Opcodes.ACONST_NULL);
        });
    }

    this.IADD = function() {
        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.IADD);
            }
        );
    }

    this.LADD = function() {
        stackOp(
            [Type.LONG_TYPE, Type.LONG_TYPE],
            Type.LONG_TYPE,
            function() {
                mv.visitInsn(Opcodes.LADD);
            }
        );
    }

    this.FADD = function() {
        stackOp(
            [Type.FLOAT_TYPE, Type.FLOAT_TYPE],
            Type.FLOAT_TYPE,
            function() {
                mv.visitInsn(Opcodes.FADD);
            }
        );
    }

    this.DADD = function() {
        stackOp(
            [Type.DOUBLE_TYPE, Type.DOUBLE_TYPE],
            Type.DOUBLE_TYPE,
            function() {
                mv.visitInsn(Opcodes.DADD);
            }
        );
    }

    this.ISUB = function() {
        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.ISUB);
            }
        );
    }

    this.LSUB = function() {
        stackOp(
            [Type.LONG_TYPE, Type.LONG_TYPE],
            Type.LONG_TYPE,
            function() {
                mv.visitInsn(Opcodes.LSUB);
            }
        );
    }

    this.FSUB = function() {
        stackOp(
            [Type.FLOAT_TYPE, Type.FLOAT_TYPE],
            Type.FLOAT_TYPE,
            function() {
                mv.visitInsn(Opcodes.FSUB);
            }
        );
    }

    this.DSUB = function() {
        stackOp(
            [Type.DOUBLE_TYPE, Type.DOUBLE_TYPE],
            Type.DOUBLE_TYPE,
            function() {
                mv.visitInsn(Opcodes.DSUB);
            }
        );
    }

    this.IMUL = function() {
        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.IMUL);
            }
        );
    }

    this.LMUL = function() {
        stackOp(
            [Type.LONG_TYPE, Type.LONG_TYPE],
            Type.LONG_TYPE,
            function() {
                mv.visitInsn(Opcodes.LMUL);
            }
        );
    }

    this.FMUL = function() {
        stackOp(
            [Type.FLOAT_TYPE, Type.FLOAT_TYPE],
            Type.FLOAT_TYPE,
            function() {
                mv.visitInsn(Opcodes.FMUL);
            }
        );
    }

    this.DMUL = function() {
        stackOp(
            [Type.DOUBLE_TYPE, Type.DOUBLE_TYPE],
            Type.DOUBLE_TYPE,
            function() {
                mv.visitInsn(Opcodes.DMUL);
            }
        );
    }

    this.IDIV = function() {
        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.IDIV);
            }
        );
    }

    this.LDIV = function() {
        stackOp(
            [Type.LONG_TYPE, Type.LONG_TYPE],
            Type.LONG_TYPE,
            function() {
                mv.visitInsn(Opcodes.LDIV);
            }
        );
    }

    this.FDIV = function() {
        stackOp(
            [Type.FLOAT_TYPE, Type.FLOAT_TYPE],
            Type.FLOAT_TYPE,
            function() {
                mv.visitInsn(Opcodes.FDIV);
            }
        );
    }

    this.DDIV = function() {
        stackOp(
            [Type.DOUBLE_TYPE, Type.DOUBLE_TYPE],
            Type.DOUBLE_TYPE,
            function() {
                mv.visitInsn(Opcodes.DDIV);
            }
        );
    }

    this.IREM = function() {
        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.IREM);
            }
        );
    }

    this.LREM = function() {
        stackOp(
            [Type.LONG_TYPE, Type.LONG_TYPE],
            Type.LONG_TYPE,
            function() {
                mv.visitInsn(Opcodes.LREM);
            }
        );
    }

    this.FREM = function() {
        stackOp(
            [Type.FLOAT_TYPE, Type.FLOAT_TYPE],
            Type.FLOAT_TYPE,
            function() {
                mv.visitInsn(Opcodes.FREM);
            }
        );
    }

    this.DREM = function() {
        stackOp(
            [Type.DOUBLE_TYPE, Type.DOUBLE_TYPE],
            Type.DOUBLE_TYPE,
            function() {
                mv.visitInsn(Opcodes.DREM);
            }
        );
    }

    this.INEG = function() {
        stackOp(Type.INT_TYPE, function() {
            mv.visitInsn(Opcodes.INEG);
        });
    }

    this.LNEG = function() {
        stackOp(Type.LONG_TYPE, function() {
            mv.visitInsn(Opcodes.LNEG);
        });
    }

    this.FNEG = function() {
        stackOp(Type.FLOAT_TYPE, function() {
            mv.visitInsn(Opcodes.FNEG);
        });
    }

    this.DNEG = function() {
        stackOp(Type.DOUBLE_TYPE, function() {
            mv.visitInsn(Opcodes.DNEG);
        });
    }

    this.ISHL = function() {
        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.ISHL);
            }
        );
    }

    this.LSHL = function() {
        stackOp(
            [Type.INT_TYPE, Type.LONG_TYPE],
            Type.LONG_TYPE,
            function() {
                mv.visitInsn(Opcodes.LSHL);
            }
        );
    }

    this.ISHR = function() {
        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.ISHR);
            }
        );
    }

    this.LSHR = function() {
        stackOp(
            [Type.INT_TYPE, Type.LONG_TYPE],
            Type.LONG_TYPE,
            function() {
                mv.visitInsn(Opcodes.LSHR);
            }
        );
    }

    this.IUSHR = function() {
        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.IUSHR);
            }
        );
    }

    this.LUSHR = function() {
        stackOp(
            [Type.INT_TYPE, Type.LONG_TYPE],
            Type.LONG_TYPE,
            function() {
                mv.visitInsn(Opcodes.LUSHR);
            }
        );
    }

    this.IAND = function() {
        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.IAND);
            }
        );
    }

    this.LAND = function() {
        stackOp(
            [Type.LONG_TYPE, Type.LONG_TYPE],
            Type.LONG_TYPE,
            function() {
                mv.visitInsn(Opcodes.LAND);
            }
        );
    }

    this.IOR = function() {
        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.IOR);
            }
        );
    }

    this.LOR = function() {
        stackOp(
            [Type.LONG_TYPE, Type.LONG_TYPE],
            Type.LONG_TYPE,
            function() {
                mv.visitInsn(Opcodes.LOR);
            }
        );
    }

    this.IXOR = function() {
        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.IXOR);
            }
        );
    }

    this.LXOR = function() {
        stackOp(
            [Type.LONG_TYPE, Type.LONG_TYPE],
            Type.LONG_TYPE,
            function() {
                mv.visitInsn(Opcodes.LXOR);
            }
        );
    }

    this.LCMP = function() {
        stackOp(
            [Type.LONG_TYPE, Type.LONG_TYPE],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.LCMP);
            }
        );
    }

    this.FCMPL = function() {
        stackOp(
            [Type.FLOAT_TYPE, Type.FLOAT_TYPE],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.FCMPL);
            }
        );
    }

    this.FCMPG = function() {
        stackOp(
            [Type.FLOAT_TYPE, Type.FLOAT_TYPE],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.FCMPG);
            }
        );
    }

    this.DCMPL = function() {
        stackOp(
            [Type.DOUBLE_TYPE, Type.DOUBLE_TYPE],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.DCMPL);
            }
        );
    }

    this.DCMPG = function() {
        stackOp(
            [Type.DOUBLE_TYPE, Type.DOUBLE_TYPE],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.DCMPG);
            }
        );
    }

    this.I2B = function() {
        stackOp(Type.INT_TYPE, Type.BYTE_TYPE, function() {
            mv.visitInsn(Opcodes.I2B);
        });
    }

    this.I2C = function() {
        stackOp(Type.INT_TYPE, Type.CHAR_TYPE, function() {
            mv.visitInsn(Opcodes.I2C);
        });
    }

    this.I2S = function() {
        stackOp(Type.INT_TYPE, Type.SHORT_TYPE, function() {
            mv.visitInsn(Opcodes.I2S);
        });
    }

    this.L2I = function() {
        stackOp(Type.LONG_TYPE, Type.INT_TYPE, function() {
            mv.visitInsn(Opcodes.L2I);
        });
    }

    this.F2I = function() {
        stackOp(Type.FLOAT_TYPE, Type.INT_TYPE, function() {
            mv.visitInsn(Opcodes.F2I);
        });
    }

    this.D2I = function() {
        stackOp(Type.DOUBLE_TYPE, Type.INT_TYPE, function() {
            mv.visitInsn(Opcodes.D2I);
        });
    }

    this.I2L = function() {
        stackOp(Type.INT_TYPE, Type.LONG_TYPE, function() {
            mv.visitInsn(Opcodes.I2L);
        });
    }

    this.F2L = function() {
        stackOp(Type.FLOAT_TYPE, Type.LONG_TYPE, function() {
            mv.visitInsn(Opcodes.F2L);
        });
    }

    this.D2L = function() {
        stackOp(Type.DOUBLE_TYPE, Type.LONG_TYPE, function() {
            mv.visitInsn(Opcodes.D2L);
        });
    }

    this.I2F = function() {
        stackOp(Type.INT_TYPE, Type.FLOAT_TYPE, function() {
            mv.visitInsn(Opcodes.I2F);
        });
    }

    this.L2F = function() {
        stackOp(Type.LONG_TYPE, Type.FLOAT_TYPE, function() {
            mv.visitInsn(Opcodes.L2F);
        });
    }

    this.D2F = function() {
        stackOp(Type.DOUBLE_TYPE, Type.FLOAT_TYPE, function() {
            mv.visitInsn(Opcodes.D2F);
        });
    }

    this.I2D = function() {
        stackOp(Type.INT_TYPE, Type.DOUBLE_TYPE, function() {
            mv.visitInsn(Opcodes.I2D);
        });
    }

    this.L2D = function() {
        stackOp(Type.LONG_TYPE, Type.DOUBLE_TYPE, function() {
            mv.visitInsn(Opcodes.L2D);
        });
    }

    this.F2D = function() {
        stackOp(Type.FLOAT_TYPE, Type.DOUBLE_TYPE, function() {
            mv.visitInsn(Opcodes.F2D);
        });
    }

    this.CHECKCAST = function(clz) {
        stackOp(clz, clz, function() {
            mv.visitTypeInsn(Opcodes.CHECKCAST, getType(clz).descriptor);
        });
    }

    this.NEW = function(clz) {
        stackOp(null, clz, function() {
            mv.visitTypeInsn(Opcodes.NEW, getType(clz).descriptor);
        });
    }

    this.GETFIELD = function(c, f, t) {
        stackOp(c, t, function() {
            mv.visitFieldInsn(Opcodes.GETFIELD, getType(c).descriptor, f, getType(t).descriptor);
        });
    }

    this.PUTFIELD = function(c, f, t) {
        stackOp([t, c], null, function() {
            mv.visitFieldInsn(Opcodes.GETFIELD, getType(c).descriptor, f, getType(t).descriptor);
        });
    }

    this.GETSTATIC = function(c, f, t) {
        stackOp(null, t, function() {
            mv.visitFieldInsn(Opcodes.GETSTATIC, getType(c).descriptor, f, getType(t).descriptor);
        });
    }

    this.PUTSTATIC = function(c, f, t) {
        stackOp(t, null, function() {
            mv.visitFieldInsn(Opcodes.PUTSTATIC, getType(c).descriptor, f, getType(t).descriptor);
        });
    }

    this.INVOKEVIRTUAL = function(c, m, args, r) {
        invoke(c, m, args, r, Opcodes.INVOKEVIRTUAL);
    }

    this.INVOKESPECIAL = function(c, m, args, r) {
        invoke(c, m, args, r, Opcodes.INVOKESPECIAL);
    }

    this.INVOKESTATIC = function(c, m, args, r) {
        invoke(c, m, args, r, Opcodes.INVOKESTATIC);
    }

    this.INVOKEINTERFACE = function(c, m, args, r) {
        invoke(c, m, args, r, Opcodes.INVOKEINTERFACE);
    }

    this.INVOKEDYNAMIC = function(m ,t, bsm) {

    }

    this.INSTANCEOF = function(clz) {
        clz = getType(clz);
        stackOp(
            [OBJECT_INSTANCE],
            Type.INT_TYPE,
            function() {
                mv.visitTypeInsn(Opcodes.INSTANCEOF, clz.descriptor);
            }
        );
    }

    this.MONITORENTER = function() {
        stackOp(
            [OBJECT_INSTANCE],
            null,
            function() {
                mv.visitInsn(Opcodes.MONITORENTER);
            }
        );
    }

    this.MONITOREXIT = function() {
        stackOp(
            [Type.VOID_TYPE],
            null,
            function() {
                mv.visitInsn(Opcodes.MONITOREXIT);
            }
        );
    }

    this.NEWARRAY = function(t) {
        t = getType(t);

        stackOp(
            [Type.INT_TYPE],
            Type.getType("[" + t.internalName),
            function() {
                mv.visitTypeInsn(Opcodes.NEWARRAY, t.descriptor);
            }
        );
    }

    this.ANEWARRAY = function(clz) {
        clz = getType(clz);

        stackOp(
            [Type.INT_TYPE],
            Type.getType("[" + clz.descriptor),
            function() {
                mv.visitTypeInsn(Opcodes.ANEWARRAY, clz.descriptor);
            }
        );
    }

    this.MULTIANEWARRAY = function(t, n) {
        t = getType(t);

        var types = new Array();
        var prefix = "";
        for(var i=0;i<n;i++) {
            types[i] = Type.INT_TYPE;
            prefix += "[";
        }

        stackOp(
            types,
            Type.getType(prefix + t.descriptor),
            function() {
                mv.visitMultiANewArrayInsn(t.descriptor, n);
            }
        );
    }

    this.BALOAD = function() {
        stackOp(
            [Type.INT_TYPE, Type.getType("[" + Type.BYTE_TYPE.descriptor)],
            Type.BYTE_TYPE,
            function() {
                mv.visitInsn(Opcodes.BALOAD);
            }
        );
    }

    this.CALOAD = function() {
        stackOp(
            [Type.INT_TYPE, Type.getType("[" + Type.CHAR_TYPE.descriptor)],
            Type.CHAR_TYPE,
            function() {
                mv.visitInsn(Opcodes.CALOAD);
            }
        );
    }

    this.SALOAD = function() {
        stackOp(
            [Type.INT_TYPE, Type.getType("[" + Type.SHORT_TYPE.descriptor)],
            Type.SHORT_TYPE,
            function() {
                mv.visitInsn(Opcodes.SALOAD);
            }
        );
    }

    this.IALOAD = function() {
        stackOp(
            [Type.INT_TYPE, Type.getType("[" + Type.INT_TYPE.descriptor)],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.IALOAD);
            }
        );
    }

    this.LALOAD = function() {
        stackOp(
            [Type.INT_TYPE, Type.getType("[" + Type.LONG_TYPE.descriptor)],
            Type.LONG_TYPE,
            function() {
                mv.visitInsn(Opcodes.LALOAD);
            }
        );
    }

    this.FALOAD = function() {
        stackOp(
            [Type.INT_TYPE, Type.getType("[" + Type.FLOAT_TYPE.descriptor)],
            Type.FLOAT_TYPE,
            function() {
                mv.visitInsn(Opcodes.FALOAD);
            }
        );
    }

    this.DALOAD = function() {
        stackOp(
            [Type.INT_TYPE, Type.getType("[" + Type.DOUBLE_TYPE.descriptor)],
            Type.DOUBLE_TYPE,
            function() {
                mv.visitInsn(Opcodes.DALOAD);
            }
        );
    }

    this.AALOAD = function() {
        stackOp(
            [Type.INT_TYPE, OBJECT_INSTANCE],
            OBJECT_INSTANCE,
            function() {
                mv.visitInsn(Opcodes.AALOAD);
            }
        );
    }

    this.BASTORE = function() {
        stackOp(
            [Type.BYTE_TYPE, Type.INT_TYPE, Type.getType("[" + Type.BYTE_TYPE.descriptor)],
            null,
            function() {
                mv.visitInsn(Opcodes.BASTORE);
            }
        );
    }

    this.CASTORE = function() {
        stackOp(
            [Type.CHAR_TYPE, Type.INT_TYPE, Type.getType("[" + Type.CHAR_TYPE.descriptor)],
            null,
            function() {
                mv.visitInsn(Opcodes.CASTORE);
            }
        );
    }

    this.SASTORE = function() {
        stackOp(
            [Type.SHORT_TYPE, Type.INT_TYPE, Type.getType("[" + Type.SHORT_TYPE.descriptor)],
            null,
            function() {
                mv.visitInsn(Opcodes.SASTORE);
            }
        );
    }

    this.IASTORE = function() {
        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE, Type.getType("[" + Type.INT_TYPE.descriptor)],
            null,
            function() {
                mv.visitInsn(Opcodes.IASTORE);
            }
        );
    }

    this.LASTORE = function() {
        stackOp(
            [Type.LONG_TYPE, Type.INT_TYPE, Type.getType("[" + Type.LONG_TYPE.descriptor)],
            null,
            function() {
                mv.visitInsn(Opcodes.LASTORE);
            }
        );
    }

    this.FASTORE = function() {
        stackOp(
            [Type.FLOAT_TYPE, Type.INT_TYPE, Type.getType("[" + Type.FLOAT_TYPE.descriptor)],
            null,
            function() {
                mv.visitInsn(Opcodes.FASTORE);
            }
        );
    }

    this.DASTORE = function() {
        stackOp(
            [Type.DOUBLE_TYPE, Type.INT_TYPE, Type.getType("[" + Type.DOUBLE_TYPE.descriptor)],
            null,
            function() {
                mv.visitInsn(Opcodes.DASTORE);
            }
        );
    }

    this.AASTORE = function() {
        stackOp(
            [OBJECT_INSTANCE, Type.INT_TYPE, OBJECT_INSTANCE],
            null,
            function() {
                mv.visitInsn(Opcodes.AASTORE);
            }
        );
    }

    this.ARRAYLENGTH = function() {
        stackOp(
            [OBJECT_INSTANCE],
            Type.INT_TYPE,
            function() {
                mv.visitInsn(Opcodes.ARRAYLENGTH);
            }
        );
    }

    this.IFEQ = function(label) {
        if (label === undefined || label === null) {
            throw new IllegalArgumentException();
        }

        stackOp(
            [Type.INT_TYPE],
            null,
            function() {
                mv.visitJumpInsn(Opcodes.IFEQ, label);
            }
        );
    }

    this.IFNE = function(label) {
        if (label === undefined || label === null) {
            throw new IllegalArgumentException();
        }

        stackOp(
            [Type.INT_TYPE],
            null,
            function() {
                mv.visitJumpInsn(Opcodes.IFNE, label);
            }
        );
    }

    this.IFLT = function(label) {
        if (label === undefined || label === null) {
            throw new IllegalArgumentException();
        }

        stackOp(
            [Type.INT_TYPE],
            null,
            function() {
                mv.visitJumpInsn(Opcodes.IFLT, label);
            }
        );
    }

    this.IFGE = function(label) {
        if (label === undefined || label === null) {
            throw new IllegalArgumentException();
        }

        stackOp(
            [Type.INT_TYPE],
            null,
            function() {
                mv.visitJumpInsn(Opcodes.IFGE, label);
            }
        );
    }

    this.IFGT = function(label) {
        if (label === undefined || label === null) {
            throw new IllegalArgumentException();
        }

        stackOp(
            [Type.INT_TYPE],
            null,
            function() {
                mv.visitJumpInsn(Opcodes.IFGT, label);
            }
        );
    }

    this.IFLE = function(label) {
        if (label === undefined || label === null) {
            throw new IllegalArgumentException();
        }

        stackOp(
            [Type.INT_TYPE],
            null,
            function() {
                mv.visitJumpInsn(Opcodes.IFLE, label);
            }
        );
    }

    this.IF_ICMPEQ = function(label) {
        if (label === undefined || label === null) {
            throw new IllegalArgumentException();
        }

        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE],
            null,
            function() {
                mv.visitJumpInsn(Opcodes.IF_ICMPEQ, label);
            }
        );
    }

    this.IF_ICMPNE = function(label) {
        if (label === undefined || label === null) {
            throw new IllegalArgumentException();
        }

        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE],
            null,
            function() {
                mv.visitJumpInsn(Opcodes.IF_ICMPNE, label);
            }
        );
    }

    this.IF_ICMPLT = function(label) {
        if (label === undefined || label === null) {
            throw new IllegalArgumentException();
        }

        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE],
            null,
            function() {
                mv.visitJumpInsn(Opcodes.IF_ICMPLT, label);
            }
        );
    }

    this.IF_ICMPGE = function(label) {
        if (label === undefined || label === null) {
            throw new IllegalArgumentException();
        }

        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE],
            null,
            function() {
                mv.visitJumpInsn(Opcodes.IF_ICMPGE, label);
            }
        );
    }

    this.IF_ICMPGT = function(label) {
        if (label === undefined || label === null) {
            throw new IllegalArgumentException();
        }

        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE],
            null,
            function() {
                mv.visitJumpInsn(Opcodes.IF_ICMPGT, label);
            }
        );
    }

    this.IF_ICMPLE = function(label) {
        if (label === undefined || label === null) {
            throw new IllegalArgumentException();
        }

        stackOp(
            [Type.INT_TYPE, Type.INT_TYPE],
            null,
            function() {
                mv.visitJumpInsn(Opcodes.IF_ICMPLE, label);
            }
        );
    }

    this.IF_ACMPEQ = function(label) {
        if (label === undefined || label === null) {
            throw new IllegalArgumentException();
        }

        stackOp(
            [OBJECT_INSTANCE, OBJECT_INSTANCE],
            null,
            function() {
                mv.visitJumpInsn(Opcodes.IF_ACMPEQ, label);
            }
        );
    }

    this.IF_ACMPNE = function(label) {
        if (label === undefined || label === null) {
            throw new IllegalArgumentException();
        }

        stackOp(
            [OBJECT_INSTANCE, OBJECT_INSTANCE],
            null,
            function() {
                mv.visitJumpInsn(Opcodes.IF_ACMPNE, label);
            }
        );
    }

    this.IFNULL = function(label) {
        if (label === undefined || label === null) {
            throw new IllegalArgumentException();
        }

        stackOp(
            [OBJECT_INSTANCE],
            null,
            function() {
                mv.visitJumpInsn(Opcodes.IFNULL, label);
            }
        );
    }

    this.IFNONNULL = function(label) {
        if (label === undefined || label === null) {
            throw new IllegalArgumentException();
        }

        stackOp(
            [OBJECT_INSTANCE],
            null,
            function() {
                mv.visitJumpInsn(Opcodes.IFNONNULL, label);
            }
        );
    }

    this.GOTO = function(label) {
        if (label === undefined || label === null) {
            throw new IllegalArgumentException();
        }

        mv.visitJumpInsn(Opcodes.GOTO, label);
    }

    this.TABLESWITCH = function(min, max, deflt, labels) {
        if (min >= max ||
            deflt === null ||
            deflt === undefined ||
            labels === null |
            labels === undefined ||
            labels.length === undefined)
        {
            throw new IllegalArgumentException();
        }

        var jLabels = toJavaArray(labels, Packages.jdk.internal.org.objectweb.asm.Label);

        stackOp(
            [Type.INT_TYPE],
            null,
            function() {
                mv.visitTableSwitchInsn(min, max, deflt, jLabels);
            }
        );
    }

    this.LOOKUPSWITCH = function(deflt, vals, labels) {
        if (deflt === null ||
            deflt === undefined ||
            vals === null ||
            vals === undefined ||
            !(vals instanceof Array) ||
            labels === undefined ||
            labels === null ||
            !(labels instanceof Array))
        {
            throw new IllegalArgumentException();
        }

        var jLabels = toJavaArray(labels, Packages.jdk.internal.org.objectweb.asm.Label);
        var jVals = toJavaArray(vals, Packages.java.lang.Integer.TYPE);

        stackOp(
            [Type.INT_TYPE],
            null,
            function() {
                mv.visitLookupSwitchInsn(deflt, jVals, jLabels);
            }
        );
    }

    this.IRETURN = function() {
        stackOp(
            [Type.INT_TYPE],
            null,
            function() {
                mv.visitInsn(Opcodes.IRETURN);
            }
        );
    }

    this.LRETURN = function() {
        stackOp(
            [Type.LONG_TYPE],
            null,
            function() {
                mv.visitInsn(Opcodes.LRETURN);
            }
        );
    }

    this.FRETURN = function() {
        stackOp(
            [Type.FLOAT_TYPE],
            null,
            function() {
                mv.visitInsn(Opcodes.FRETURN);
            }
        );
    }

    this.DRETURN = function() {
        stackOp(
            [Type.DOUBLE_TYPE],
            null,
            function() {
                mv.visitInsn(Opcodes.DRETURN);
            }
        );
    }

    this.ARETURN = function() {
        stackOp(
            [OBJECT_INSTANCE],
            null,
            function() {
                mv.visitInsn(Opcodes.ARETURN);
            }
        );
    }

    this.RETURN = function() {
        mv.visitInsn(Opcodes.RETURN);
    }

    this.ATHROW = function() {
        stackOp(
            [OBJECT_INSTANCE],
            null,
            function() {
                mv.visitInsn(Opcodes.ATHROW);
            }
        );
    }

    this.LABEL = function(label) {
        if (label === undefined) {
            return new Packages.jdk.internal.org.objectweb.asm.Label();
        }

        mv.visitLabel(label);
    }

    this.TRYCATCH = function(start, end, handler, type) {
        if (start === undefined ||
            start === null ||
            end === undefined ||
            end === null ||
            handler === undefined ||
            handler === null)
        {
            throw new IllegalArgumentException();
        }

        mv.visitTryCatchBlock(start, end, handler, getType(type !== undefined ? type : null));
    }

    this.VAR = function(name, type, sig, start, end) {
        if (name === undefined ||
            name === null |
            type === undefined ||
            type === null ||
            start === undefined ||
            start === null ||
            end === undefined ||
            end === null)
        {
            throw new IllegalArgumentException();
        }

        type = getType(type);
        var v = new Variable(name, type, sig);

        mv.visitLocalVariable(v.name, v.type, v.sig === undefined ? null : v.sig, start, end, v.idx);

        return v;
    }

    function stackOp(type, op) {
        stackOp(type, type, op);
    }

    function stackOp(argTypes, retType, op, checkType) {
        if (argTypes !== undefined && argTypes !== null) {
            if (!(argTypes instanceof Array)) {
                argTypes = [argTypes];
            }
            var types = stack.pop(argTypes.length);

            for(var i in argTypes) {
                if ((!(argTypes[i] instanceof Type)) ||
                    types[i].size !== argTypes[i].size ||
                    (checkType === true &&
                     types[i] !== argTypes[i])) {
                    // stack specific error
                    println("!!! expecting " + argTypes[i] + ", got " + types[i] + " instead");
                    throw new IllegalArgumentException();
                }
            }
        }

        if (op !== undefined && op !== null) {
            if (typeof(op) !== "function") {
                throw new IllegalArgumentException();
            }
            op();
        }

        if (retType !== undefined && retType !== null) {
            if (retType instanceof Type) {
                if (retType !== Type.VOID_TYPE) {
                    stack.push(retType);
                }
            } else {
                throw new IllegalArgumentException();
            }
        }

        println(stack);
    }

    function asInteger(n) {
        return Packages.java.lang.Integer.valueOf(n);
    }

    function asLong(n) {
        return Packages.java.lang.Long.valueOf(n);
    }

    function asFloat(n) {
        return Packages.java.lang.Float.valueOf(n);
    }

    function asDouble(n) {
        return Packages.java.lang.Double.valueOf(n);
    }

    function invoke(c, m, args, r, opcode) {
        if (opcode === undefined || opcode === null) {
            throw new IllegalArgumentException();
        }

        c = getType(c, true);

        if (r === undefined || r === null) {
            r = Type.VOID_TYPE;
        }

        r = getType(r, true);

        if (args === undefined || args === null) {
            args = new Array();
        }
        if (!(args instanceof Array)) {
            args = [args];
        }

        var jArgs = toJavaArray(args, Packages.jdk.internal.org.objectweb.asm.Type, function(it) {
            if (typeof(it) === "string") {
                return Type.getObjectType(it.replaceAll(".", "/"));
            }
        });

        if (opcode !== Opcodes.INVOKESTATIC) {
            args.push(c);
        }

        stackOp(args, r, function() {
            mv.visitMethodInsn(opcode, c.internalName, m, Type.getMethodDescriptor(r, jArgs));
        });

    }

    function Variable(name, type, sig, i) {
        this.name = name;
        this.type = getType(type);
        this.sig = sig;
        if (i === undefined) {
            this.idx = varCounter;
            varCounter += this.type.size;
        } else {
            this.idx = i;
        }

        this.toString = function() {
            return name + "(" + type + ")#" + this.idx;
        }
    }
}

/**
* ReplaceAll by Fagner Brack (MIT Licensed)
* Replaces all occurrences of a substring in a string
*/
String.prototype.replaceAll = function( token, newToken, ignoreCase ) {
   var _token;
   var str = this + "";
   var i = -1;

   if ( typeof token === "string" ) {

       if ( ignoreCase ) {

           _token = token.toLowerCase();

           while( (
               i = str.toLowerCase().indexOf(
                   token, i >= 0 ? i + newToken.length : 0
               ) ) !== -1
           ) {
               str = str.substring( 0, i ) +
                   newToken +
                   str.substring( i + token.length );
           }

       } else {
           return this.split( token ).join( newToken );
       }

   }
   return str;
};

function toJavaArray(arr, type, convert) {
//    println("to java array: " + arr + " " + type)
    var jArr = Packages.java.lang.reflect.Array.newInstance(type, arr !== undefined && arr !== null ? arr.length : 0);
    if (arr !== undefined && arr !== null) {
        for(var i in arr) {
            if (convert !== undefined) {
                jArr[i] = convert(arr[i]);
            } else {
                jArr[i] = arr[i];
            }
        }
    }
    return jArr;
}

function getType(t, obj) {
    if (t === null) return null;
    if (t === undefined) return Type.VOID_TYPE;
    if (!(t instanceof Type)) {
        if (typeof(t) === "string") {
            return obj === true ? Type.getObjectType(t.replaceAll(".", "/")) : Type.getType(t.replaceAll(".", "/"));
        } else {
            throw new IllegalArgumentException();
        }
    }
    return t;
}