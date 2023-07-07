import { ChartNode, NodeId, NodeInputDefinition, NodeOutputDefinition, PortId } from '../NodeBase.js';
import { nanoid } from 'nanoid';
import { EditorDefinition, NodeImpl, nodeDefinition } from '../NodeImpl.js';
import { Inputs, Outputs } from '../GraphProcessor.js';
import { coerceType, coerceTypeOptional } from '../../index.js';
import { match } from 'ts-pattern';

export type EvaluateNode = ChartNode<'evaluate', EvaluateNodeData>;

export type EvaluateNodeData = {
  operation: '+' | '-' | '*' | '/' | '^' | '%' | 'abs' | 'negate';
  useOperationInput?: boolean;
};

const unaryOperation = ['abs', 'negate'] as const;
type Unary = (typeof unaryOperation)[number];
const isUnaryOp = (operation: string): operation is Unary => unaryOperation.includes(operation as Unary);

export class EvaluateNodeImpl extends NodeImpl<EvaluateNode> {
  static create(): EvaluateNode {
    const chartNode: EvaluateNode = {
      type: 'evaluate',
      title: 'Evaluate',
      id: nanoid() as NodeId,
      visualData: {
        x: 0,
        y: 0,
        width: 175,
      },
      data: {
        operation: '+',
      },
    };

    return chartNode;
  }

  getInputDefinitions(): NodeInputDefinition[] {
    const inputs: NodeInputDefinition[] = [
      {
        dataType: 'number',
        id: 'a' as PortId,
        title: 'A',
      },
    ];

    const isUnary = !this.data.useOperationInput && isUnaryOp(this.data.operation);

    if (!isUnary) {
      inputs.push({
        dataType: 'number',
        id: 'b' as PortId,
        title: 'B',
      });
    }

    if (this.data.useOperationInput) {
      inputs.push({
        dataType: 'string',
        id: 'operation' as PortId,
        title: 'Operation',
      });
    }

    return inputs;
  }

  getOutputDefinitions(): NodeOutputDefinition[] {
    return [
      {
        dataType: 'number',
        id: 'output' as PortId,
        title: 'Output',
      },
    ];
  }

  getEditors(): EditorDefinition<EvaluateNode>[] {
    return [
      {
        type: 'dropdown',
        label: 'Operation',
        dataKey: 'operation',
        options: [
          { label: '+', value: '+' },
          { label: '-', value: '-' },
          { label: '*', value: '*' },
          { label: '/', value: '/' },
          { label: '^', value: '^' },
          { label: '%', value: '%' },
          { label: 'abs', value: 'abs' },
          { label: 'negate', value: 'negate' },
        ],
        useInputToggleDataKey: 'useOperationInput',
      },
    ];
  }

  getBody(): string | undefined {
    const isUnary = !this.data.useOperationInput && isUnaryOp(this.data.operation);

    if (isUnary) {
      return match(this.data.operation as Unary)
        .with('abs', () => 'abs(A)')
        .with('negate', () => '-A')
        .exhaustive();
    }

    if (this.data.operation === '^') {
      return '!markdownA<sup>B</sup>';
    }

    return this.data.useOperationInput ? 'A (Operation) B' : `A ${this.data.operation} B`;
  }

  async process(inputs: Inputs): Promise<Outputs> {
    const operation = (
      this.data.useOperationInput ? coerceType(inputs['operation' as PortId], 'string') : this.data.operation
    ) as EvaluateNodeData['operation'];

    const inputA = coerceTypeOptional(inputs['a' as PortId], 'number');
    const inputB = coerceTypeOptional(inputs['b' as PortId], 'number');

    if (isUnaryOp(operation) && inputA) {
      return {
        ['output' as PortId]: {
          type: 'number',
          value: match(operation as Extract<EvaluateNodeData['operation'], Unary>)
            .with('abs', () => Math.abs(inputA))
            .with('negate', () => -inputA)
            .exhaustive(),
        },
      };
    }

    if (inputA == null || inputB == null) {
      throw new Error('Missing input');
    }

    return {
      ['output' as PortId]: {
        type: 'number',
        value: match(operation as Exclude<EvaluateNodeData['operation'], Unary>)
          .with('+', () => inputA + inputB)
          .with('-', () => inputA - inputB)
          .with('*', () => inputA * inputB)
          .with('/', () => inputA / inputB)
          .with('^', () => Math.pow(inputA, inputB))
          .with('%', () => inputA % inputB)
          .exhaustive(),
      },
    };
  }
}

export const evaluateNode = nodeDefinition(EvaluateNodeImpl, 'Evaluate');
